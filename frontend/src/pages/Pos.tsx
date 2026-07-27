import { useEffect, useMemo, useRef, useState } from "react";
import { productsApi, type Product } from "@/api/products";
import { servicesApi, type Service } from "@/api/services";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { usePosScanner } from "@/hooks/usePosScanner";
import { useDialog } from "@/hooks/useDialog";
import { useCheckout } from "@/hooks/useCheckout";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { PosScannerSection } from "@/components/pos/PosScannerSection";
import { PosMobileCheckout } from "@/components/pos/PosMobileCheckout";
import { usePosStore, type CartItem, type ProductCartItem, type ServiceCartItem } from "@/store/posStore";
import { money } from "@/lib/format";
import { PosSearchBar, type SearchResult } from "@/components/pages/pos/PosSearchBar";
import { PosCartTable } from "@/components/pages/pos/PosCartTable";
import { PosPaymentPanel } from "@/components/pages/pos/PosPaymentPanel";
import { PosCompletedSaleModal } from "@/components/pages/pos/PosCompletedSaleModal";
import { PosDialog } from "@/components/pages/pos/PosDialog";
import styles from "./Pos.module.css";
import { useAuth } from "@/context/AuthContext";

export default function Pos() {
  const { user } = useAuth()
  const scanRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [scan, setScan] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const { storeName, storeAddress, storePhone, storeFooter } = useStoreSettings();
  const [showResults, setShowResults] = useState(false);
  const [addingToService, setAddingToService] = useState<string | null>(null);
  const [serviceProductSearch, setServiceProductSearch] = useState("");
  const [showMobileCheckout, setShowMobileCheckout] = useState(false);

  const { dialog, showAlert, showConfirm, closeDialog } = useDialog();

  const {
    active: scannerActive,
    toggle: toggleScanner,
    toggleButtonRef: scannerToggleRef,
    elementId,
  } = usePosScanner({
    onScan: async (decodedText) => {
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
  });

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
  const updateServiceProductQty = usePosStore((s) => s.updateServiceProductQty);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { results: searchResults, loading: searchLoading } = useDebouncedSearch<SearchResult>({
    query: scan,
    fetcher: async (term) => {
      const [prodRes, svcRes] = await Promise.all([
        productsApi.list({ search: term, active: true, limit: 15 }),
        servicesApi.list({ search: term, active: true, limit: 15 }),
      ]);

      const results: SearchResult[] = [];
      for (const p of prodRes.products) {
        results.push({ _type: "product", id: p.id, name: p.name, barcode: p.barcode, price: p.price, data: p });
      }
      for (const s of svcRes.services) {
        results.push({ _type: "service", id: s.id, name: s.name, barcode: undefined, price: s.base_price, data: s });
      }
      return results;
    },
  });

  // Cargar productos solo cuando se abre el modal de agregar a servicio
  useEffect(() => {
    if (addingToService && products.length === 0) {
      productsApi.list({ active: true, limit: 100 })
        .then((res) => setProducts(res.products))
        .catch(() => { });
    }
  }, [addingToService]);

  async function addToCart(result: SearchResult) {
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

      let productsList = products;
      if (productsList.length === 0) {
        try {
          const res = await productsApi.list({ active: true, limit: 100 });
          productsList = res.products;
          setProducts(res.products);
        } catch {
          showAlert("No se pudo verificar el stock de los productos del servicio");
          return;
        }
      }

      const existing = cart.find((x) => x._type === "service" && x.service_id === service.id);
      const totalQty = (existing?.quantity ?? 0) + 1;

      const stocks = new Map<string, number>();
      const shortages: string[] = [];
      for (const sp of service.products) {
        const product = productsList.find((p) => p.id === sp.product_id);
        if (!product) {
          shortages.push(`"${sp.product_name}" (no se pudo verificar stock)`);
          continue;
        }
        stocks.set(sp.product_id, product.stock);
        const required = sp.quantity * totalQty;
        if (required > product.stock) {
          shortages.push(`"${sp.product_name}": disponible ${product.stock}, requerido ${required} (${sp.quantity} × ${totalQty})`);
        }
      }

      if (shortages.length > 0) {
        showAlert(`No hay stock suficiente para "${service.name}":\n\n${shortages.join("\n")}`);
        return;
      }

      usePosStore.getState().addToCart({
        id: service.id,
        service_id: service.id,
        name: service.name,
        base_price: service.base_price,
        products: service.products,
      }, stocks);
    }
    setScan("");
    setShowResults(false);
  }

  function handleSetQty(item: CartItem, newQty: number): boolean {
    if (item._type === "product" && newQty > item.quantity) {
      const prod = item as ProductCartItem;
      if (prod.stock <= 0) {
        showAlert(`"${prod.name}" no tiene stock disponible`);
        return false;
      }
      if (newQty > prod.stock) {
        showAlert(`Stock insuficiente para "${prod.name}": disponible ${prod.stock}, solicitado ${newQty}`);
        return false;
      }
    } else if (item._type === "service" && newQty > item.quantity) {
      const svc = item;
      for (const sp of svc.products) {
        const required = sp.quantity * newQty;
        if (required > sp.stock) {
          showAlert(`Stock insuficiente para "${sp.product_name}" (sub-producto de "${svc.name}"): disponible ${sp.stock}, requerido ${required} (${sp.quantity} × ${newQty})`);
          return false;
        }
      }
    }
    setQty(item.id, newQty);
    return true;
  }

  function handleAddServiceProduct(serviceId: string, product: Product, qty: number): boolean {
    const svc = cart.find((x) => x._type === "service" && x.service_id === serviceId);
    if (svc && svc._type === "service") {
      const required = qty * svc.quantity;
      if (required > product.stock) {
        showAlert(`Stock insuficiente para "${product.name}": disponible ${product.stock}, requerido ${required} (${qty} × ${svc.quantity} servicios)`);
        return false;
      }
    }
    addServiceProduct(serviceId, product, qty);
    return true;
  }

  function handleUpdateServiceProductQty(serviceId: string, productId: string, qty: number): boolean {
    const svc = cart.find((x) => x._type === "service" && x.service_id === serviceId);
    if (svc && svc._type === "service") {
      const sp = svc.products.find((p) => p.product_id === productId);
      if (sp) {
        const required = qty * svc.quantity;
        if (required > sp.stock) {
          showAlert(`Stock insuficiente para "${sp.product_name}": disponible ${sp.stock}, requerido ${required} (${qty} × ${svc.quantity} servicios)`);
          return false;
        }
      }
    }
    updateServiceProductQty(serviceId, productId, qty);
    return true;
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
    const discount = subtotal * (discountPct / 100);
    const total = subtotal - discount;
    const change = (payment === "efectivo" || manualAmount) && received ? Math.max(0, Number(received) - total) : 0;
    return { subtotal, discount, total, change };
  }, [cart, discountPct, payment, received]);

  const { completedSale, checkout, handlePrintTicket, finalizeSale } = useCheckout({
    cart,
    totals,
    payment,
    received,
    manualAmount,
    currency,
    discountPct,
    userName: user?.name ?? "Sistema",
    storeSettings: { storeName, storeAddress, storePhone, storeFooter },
    showAlert,
    setCheckingOut,
    clearCart,
  });

  // Cuando se finaliza una venta (completedSale pasa a null),
  // volver automáticamente a la pantalla de scanner/búsqueda en mobile
  useEffect(() => {
    if (!completedSale) {
      setShowMobileCheckout(false);
    }
  }, [completedSale]);

  function handleFinalizeSale() {
    finalizeSale();
    setShowMobileCheckout(false);
  }

  return (
    <div className={styles.grid}>
      {/* ─── Mobile checkout view ───────────────────────────── */}
      {showMobileCheckout && (
        <PosMobileCheckout
          onClose={() => setShowMobileCheckout(false)}
          cartProps={{
            cart,
            products,
            addingToService,
            serviceProductSearch,
            onSetQty: handleSetQty,
            onDelete: (id) => setQty(id, 0),
            onAddingToService: setAddingToService,
            onServiceProductSearch: setServiceProductSearch,
            onAddServiceProduct: handleAddServiceProduct,
            onUpdateServiceProductQty: handleUpdateServiceProductQty,
            showAlert,
            readOnly: true,
          }}
          paymentProps={{
            totals,
            cartLength: cart.length,
            discountPct,
            payment,
            received,
            manualAmount,
            checkingOut,
            onDiscountPct: setDiscountPct,
            onPayment: setPayment,
            onReceived: setReceived,
            onManualAmount: setManualAmount,
            onCheckout: checkout,
            onClearCart: clearCart,
            mobileMode: true,
          }}
        />
      )}

      {/* ─── Main POS view ─────────────────────────────────── */}
      <div className={`${styles.leftPanel} ${scannerActive ? styles["left-panel-scanner-active"] : ""}`}>
        <PosScannerSection
          active={scannerActive}
          onToggle={toggleScanner}
          toggleRef={scannerToggleRef}
          elementId={elementId}
        />

        <PosSearchBar
          searchTerm={scan}
          showResults={showResults}
          searchResults={searchResults}
          searchLoading={searchLoading}
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
          onAddServiceProduct={handleAddServiceProduct}
          onUpdateServiceProductQty={handleUpdateServiceProductQty}
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
          onClose={handleFinalizeSale}
        />
      )}

      <PosDialog dialog={dialog} onClose={closeDialog} />
    </div>
  );
}


