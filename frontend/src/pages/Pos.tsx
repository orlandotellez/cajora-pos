import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { productsApi, type Product } from "@/api/products";
import { servicesApi, type Service } from "@/api/services";
import { salesApi, type CreateSalePayload } from "@/api/sales";
import { settingsApi } from "@/api/settings";
import { usePosStore, type CartItem, type ProductCartItem, type ServiceCartItem } from "@/store/posStore";
import { money } from "@/lib/format";
import { printTicket } from "@/lib/pos-ticket";
import { type PaymentMethod } from "@/lib/constants";
import { PosSearchBar, type SearchResult } from "@/components/pages/pos/PosSearchBar";
import { PosCartTable } from "@/components/pages/pos/PosCartTable";
import { PosPaymentPanel } from "@/components/pages/pos/PosPaymentPanel";
import { PosCompletedSaleModal } from "@/components/pages/pos/PosCompletedSaleModal";
import { PosDialog } from "@/components/pages/pos/PosDialog";
import styles from "./Pos.module.css";

const SCANNER_STORAGE_KEY = "pos-scanner-active";

export default function Pos() {
  const scanRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [scan, setScan] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeFooter, setStoreFooter] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [addingToService, setAddingToService] = useState<string | null>(null);
  const [serviceProductSearch, setServiceProductSearch] = useState("");
  const [completedSale, setCompletedSale] = useState<{
    saleId: string;
    cart: CartItem[];
    totals: { subtotal: number; tax: number; discount: number; total: number; change: number };
    payment: string;
    received: string;
    discountPct: number;
  } | null>(null);

  const [dialog, setDialog] = useState<{
    message: string;
    variant: "alert" | "confirm";
    onConfirm?: () => void;
  } | null>(null);

  const [showMobileCheckout, setShowMobileCheckout] = useState(false);

  const [scannerActive, setScannerActive] = useState(() => localStorage.getItem(SCANNER_STORAGE_KEY) === "true");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const scannerToggleRef = useRef<HTMLButtonElement>(null);
  const lastScannedRef = useRef<{ barcode: string; time: number } | null>(null);
  const scannerActiveRef = useRef(false);
  const lastToggleRef = useRef(0);
  const SCAN_DEBOUNCE_MS = 2000;
  const TOGGLE_THROTTLE_MS = 500;

  const showAlert = useCallback((message: string) => setDialog({ message, variant: "alert" }), []);
  const showConfirm = useCallback((message: string, onConfirm: () => void) => setDialog({ message, variant: "confirm", onConfirm }), []);

  const cart = usePosStore((s) => s.cart);
  const discountPct = usePosStore((s) => s.discountPct);
  const payment = usePosStore((s) => s.payment);
  const received = usePosStore((s) => s.received);
  const manualAmount = usePosStore((s) => s.manualAmount);
  const checkingOut = usePosStore((s) => s.checkingOut);
  const currency = usePosStore((s) => s.currency);
  const setQty = usePosStore((s) => s.setQty);
  const clearCart = usePosStore((s) => s.clearCart);
  const setDiscountPct = usePosStore((s) => s.setDiscountPct);
  const setPayment = usePosStore((s) => s.setPayment);
  const setReceived = usePosStore((s) => s.setReceived);
  const setManualAmount = usePosStore((s) => s.setManualAmount);
  const setCheckingOut = usePosStore((s) => s.setCheckingOut);
  const addServiceProduct = usePosStore((s) => s.addServiceProduct);

  useEffect(() => {
    productsApi.list({ active: true, limit: 100 })
      .then((res) => setProducts(res.products))
      .catch((err) => console.warn("Error al cargar productos:", err));

    servicesApi.list({ active: true, limit: 100 })
      .then((res) => setServices(res.services))
      .catch((err) => console.warn("Error al cargar servicios:", err));

    settingsApi.get()
      .then((res) => {
        setStoreName(res.name);
        setStoreAddress(res.address ?? "");
        setStorePhone(res.phone ?? "");
        setStoreFooter(res.ticket_footer ?? "");
      })
      .catch((err) => console.warn("Error al cargar config:", err));
  }, []);

  // ─── Inline barcode scanner ────────────────────────────────────────────
  useEffect(() => {
    scannerActiveRef.current = scannerActive;

    if (!scannerActive) {
      stopScanner();
      return;
    }

    const elId = "pos-barcode-scanner";
    queueMicrotask(() => {
      // Si el usuario ya desactivó el scanner mientras esperábamos, no iniciar
      if (!scannerActiveRef.current) return;

      const el = document.getElementById(elId);
      if (!el) return;

      // Si ya hay un scanner corriendo, no crear otro
      if (scannerRef.current) return;

      const scanner = new Html5Qrcode(elId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, aspectRatio: 1.0 },
          async (decodedText) => {
            // Debounce: evitar escanear el mismo código repetidamente
            const now = Date.now();
            if (
              lastScannedRef.current &&
              lastScannedRef.current.barcode === decodedText &&
              now - lastScannedRef.current.time < SCAN_DEBOUNCE_MS
            ) {
              return;
            }
            lastScannedRef.current = { barcode: decodedText, time: now };

            // Scan success — look up product by barcode
            try {
              const product = await productsApi.getByBarcode(decodedText);
              const result: SearchResult = {
                _type: "product",
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                price: product.price,
                data: product,
              };
              addToCart(result);
              setScan("");
              setShowResults(false);
            } catch {
              showAlert(`Producto con código "${decodedText}" no encontrado`);
            }
          },
          () => { /* scan error — ignore */ },
        )
        .catch((err) => console.warn("[PosScanner] Error:", err));
    });

    return () => {
      stopScanner();
    };
  }, [scannerActive]);

  function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      scanner.stop()
        .catch(() => {})
        .finally(() => {
          try { scanner.clear(); } catch { /* ignore */ }
        });
    } catch {
      // stop() lanzó error síncrono (e.g. "scanner is not running")
    }
  }

  // Sincronizar estado del scanner con localStorage
  useEffect(() => {
    localStorage.setItem(SCANNER_STORAGE_KEY, String(scannerActive));
  }, [scannerActive]);

  function toggleScanner() {
    const now = Date.now();
    if (now - lastToggleRef.current < TOGGLE_THROTTLE_MS) return;
    lastToggleRef.current = now;
    setScannerActive((prev) => !prev);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchResults = useMemo(() => {
    const term = scan.trim().toLowerCase();
    if (!term) return [];
    const results: SearchResult[] = [];

    for (const p of products) {
      if (!p.active) continue;
      if (
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.name.toLowerCase().includes(term)
      ) {
        results.push({ _type: "product", id: p.id, name: p.name, barcode: p.barcode, price: p.price, data: p });
        if (results.length >= 15) break;
      }
    }

    if (results.length < 15) {
      for (const s of services) {
        if (!s.is_active) continue;
        if (s.name.toLowerCase().includes(term)) {
          results.push({ _type: "service", id: s.id, name: s.name, barcode: undefined, price: s.base_price, data: s });
          if (results.length >= 15) break;
        }
      }
    }

    return results;
  }, [scan, products, services]);

  function addToCart(result: SearchResult) {
    if (result._type === "product") {
      const product = result.data as Product;
      if (product.stock <= 0) {
        showAlert(`"${product.name}" no tiene stock disponible`);
        return;
      }
      const inCart = cart.find((x) => x._type === "product" && x.id === product.id) as ProductCartItem | undefined;
      const newTotalQty = (inCart?.quantity ?? 0) + 1;
      if (newTotalQty > product.stock) {
        showAlert(`Stock insuficiente para "${product.name}": disponible ${product.stock}, ya tienes ${inCart?.quantity ?? 0} en el carrito`);
        return;
      }
      if (product.stock <= product.low_stock_threshold) {
        showConfirm(`"${product.name}" tiene stock bajo (${product.stock} unidades). ¿Agregar al carrito de todas formas?`, () => {
          usePosStore.getState().addToCart(product);
          setScan("");
          setShowResults(false);
        });
        return;
      }
      usePosStore.getState().addToCart(product);
    } else {
      const service = result.data as Service;
      usePosStore.getState().addToCart({
        id: service.id,
        service_id: service.id,
        name: service.name,
        base_price: service.base_price,
        products: service.products,
      });
    }
    setScan("");
    setShowResults(false);
  }

  function handleSetQty(item: CartItem, newQty: number) {
    if (item._type === "product" && newQty > item.quantity) {
      const prod = item as ProductCartItem;
      if (prod.stock <= 0) {
        showAlert(`"${prod.name}" no tiene stock disponible`);
        return;
      }
      if (newQty > prod.stock) {
        showAlert(`Stock insuficiente para "${prod.name}": disponible ${prod.stock}, solicitado ${newQty}`);
        return;
      }
    }
    setQty(item.id, newQty);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = scan.trim();
    if (!term) return;
    if (searchResults.length > 0) {
      addToCart(searchResults[0]);
      return;
    }
  }

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, x) => {
      if (x._type === "product") return s + x.price * x.quantity;
      const svc = x as ServiceCartItem;
      const additivePerInstance = svc.products
        .filter((sp) => sp.affects_price)
        .reduce((sum, sp) => sum + sp.unit_price * sp.quantity, 0);
      return s + (svc.base_price + additivePerInstance) * svc.quantity;
    }, 0);
    const tax = 0;
    const discount = subtotal * (discountPct / 100);
    const total = subtotal - discount;
    const change = (payment === "efectivo" || manualAmount) && received ? Math.max(0, Number(received) - total) : 0;
    return { subtotal, tax, discount, total, change };
  }, [cart, discountPct, payment, received]);

  async function checkout() {
    if (!cart.length || checkingOut) return;

    if ((payment === "efectivo" || manualAmount) && Number(received || 0) < totals.total) {
      showAlert(`El monto recibido (${money(Number(received || 0), currency)}) es menor al total (${money(totals.total, currency)}).`);
      setCheckingOut(false);
      return;
    }

    setCheckingOut(true);

    try {
      const items = cart
        .filter((x): x is ProductCartItem => x._type === "product")
        .map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          tax_rate: 0,
          line_total: item.price * item.quantity,
        }));

      const serviceItems = cart
        .filter((x): x is ServiceCartItem => x._type === "service")
        .map((item) => {
          const svcQty = item.quantity;
          const customProducts = item.products.map((sp) => ({
            product_id: sp.product_id,
            product_name: sp.product_name,
            quantity: sp.quantity * svcQty,
            unit_price: sp.unit_price,
            line_total: sp.unit_price * sp.quantity * svcQty,
            affects_price: sp.affects_price,
          }));
          const additiveTotal = customProducts
            .filter((p) => p.affects_price)
            .reduce((s, p) => s + p.line_total, 0);
          return {
            service_id: item.service_id,
            service_name: item.name,
            base_price: item.base_price,
            line_total: item.base_price * svcQty + additiveTotal,
            products: customProducts,
          };
        });

      const shouldSendAmount = payment === "efectivo" || manualAmount;

      const payload: CreateSalePayload = {
        subtotal: totals.subtotal,
        tax_total: 0,
        discount: totals.discount,
        total: totals.total,
        payment_method: payment as PaymentMethod,
        amount_received: shouldSendAmount ? Number(received || 0) : undefined,
        change_given: shouldSendAmount ? totals.change : undefined,
        items: items.length > 0 ? items : undefined,
        service_items: serviceItems.length > 0 ? serviceItems : undefined,
      };

      const sale = await salesApi.create(payload);
      setCompletedSale({
        saleId: sale.id,
        cart: [...cart],
        totals: { ...totals },
        payment,
        received,
        discountPct,
      });
    } catch (err) {
      console.error("Error al crear venta:", err);
      showAlert("Error al procesar la venta. Intenta de nuevo.");
      setCheckingOut(false);
    }
  }

  function handlePrintTicket(saleId: string) {
    if (!completedSale) return;
    printTicket(saleId, completedSale.cart, completedSale.totals, completedSale.payment, completedSale.received, storeName, storeAddress, storePhone, storeFooter, completedSale.discountPct);
    finalizeSale();
  }

  function finalizeSale() {
    setCompletedSale(null);
    clearCart();
    setCheckingOut(false);
    setShowMobileCheckout(false);
  }



  return (
    <div className={styles.grid}>
      {/* ─── Mobile checkout view ───────────────────────────── */}
      {showMobileCheckout && (
        <div className={styles["mobile-checkout"]}>
          <div className={styles["mobile-checkout-header"]}>
            <button
              onClick={() => setShowMobileCheckout(false)}
              className={styles["mobile-checkout-back"]}
            >
              ← Regresar
            </button>
            <span className={styles["mobile-checkout-title"]}>Cobrar</span>
          </div>

          <div className={styles["mobile-checkout-cart"]}>
            <PosCartTable
              cart={cart}
              products={products}
              addingToService={addingToService}
              serviceProductSearch={serviceProductSearch}
              onSetQty={handleSetQty}
              onDelete={(id) => setQty(id, 0)}
              onAddingToService={setAddingToService}
              onServiceProductSearch={setServiceProductSearch}
              onAddServiceProduct={addServiceProduct}
              showAlert={showAlert}
            />
          </div>

          <div className={styles["mobile-checkout-payment"]}>
            <PosPaymentPanel
              totals={totals}
              cartLength={cart.length}
              discountPct={discountPct}
              payment={payment}
              received={received}
              manualAmount={manualAmount}
              checkingOut={checkingOut}
              onDiscountPct={setDiscountPct}
              onPayment={setPayment}
              onReceived={setReceived}
              onManualAmount={setManualAmount}
              onCheckout={checkout}
              onClearCart={clearCart}
            />
          </div>
        </div>
      )}

      {/* ─── Main POS view ─────────────────────────────────── */}
      <div className={`${styles.leftPanel} ${scannerActive ? styles["left-panel-scanner-active"] : ""}`}>
        {/* Barcode scanner toggle + viewfinder */}
        <div className={styles["scanner-section"]}>
          <button
            ref={scannerToggleRef}
            onClick={toggleScanner}
            className={`${styles["scanner-toggle-btn"]} ${scannerActive ? styles["scanner-toggle-btn-active"] : ""}`}
            title={scannerActive ? "Desactivar escáner" : "Activar escáner de código de barras"}
          >
            <ScanBarcode size={18} />
          </button>

          <div
            className={styles["scanner-container"]}
            style={{
              maxHeight: scannerActive ? 350 : 0,
              opacity: scannerActive ? 1 : 0,
            }}
          >
            <div className={styles["scanner-camera-wrap"]}>
              <div
                id="pos-barcode-scanner"
                ref={scannerContainerRef}
                className={styles["scanner-viewfinder"]}
              />
              {/* Corner brackets + scan line (igual que en /products) */}
              <div className={styles["scanner-overlay-brackets"]} />
              <div className={styles["scanner-overlay-line"]} />
            </div>
          </div>
        </div>

        <PosSearchBar
          searchTerm={scan}
          showResults={showResults}
          searchResults={searchResults}
          searchWrapperRef={searchWrapperRef}
          inputRef={scanRef}
          onSearchChange={(v) => { setScan(v); setShowResults(true); }}
          onFocus={() => { if (scan.trim()) setShowResults(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowResults(false); }}
          onSubmit={handleSubmit}
          onAddToCart={addToCart}
        />

        <div className={styles.cartArea}>
          <PosCartTable
            cart={cart}
            products={products}
            addingToService={addingToService}
            serviceProductSearch={serviceProductSearch}
            onSetQty={handleSetQty}
            onDelete={(id) => setQty(id, 0)}
            onAddingToService={setAddingToService}
            onServiceProductSearch={setServiceProductSearch}
            onAddServiceProduct={addServiceProduct}
            showAlert={showAlert}
          />
        </div>

        {/* Mobile bottom bar — only visible on mobile when cart has items */}
        {cart.length > 0 && (
          <div className={styles["mobile-bottom-bar"]}>
            <div className={styles["mobile-bottom-bar-totals"]}>
              <span className={styles["mobile-bottom-subtotal"]}>
                Subtotal: {money(totals.subtotal, currency)}
              </span>
              <span className={styles["mobile-bottom-total"]}>
                Total: {money(totals.total, currency)}
              </span>
            </div>
            <button
              onClick={() => setShowMobileCheckout(true)}
              className={styles["mobile-bottom-checkout-btn"]}
            >
              Ir a cobrar
            </button>
          </div>
        )}
      </div>

      {/* Desktop right panel — hidden on mobile when in checkout mode */}
      <div className={styles.rightPanel}>
        <PosPaymentPanel
          totals={totals}
          cartLength={cart.length}
          discountPct={discountPct}
          payment={payment}
          received={received}
          manualAmount={manualAmount}
          checkingOut={checkingOut}
          onDiscountPct={setDiscountPct}
          onPayment={setPayment}
          onReceived={setReceived}
          onManualAmount={setManualAmount}
          onCheckout={checkout}
          onClearCart={clearCart}
        />
      </div>

      {completedSale && (
        <PosCompletedSaleModal
          completedSale={completedSale}
          storeName={storeName}
          storeAddress={storeAddress}
          storePhone={storePhone}
          storeFooter={storeFooter}
          onPrint={handlePrintTicket}
          onClose={finalizeSale}
        />
      )}

      <PosDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}


