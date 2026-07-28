import { useEffect, useState } from "react";
import { Trash2, X, ScanBarcode, Wrench, PackagePlus } from "lucide-react";
import { money } from "@/lib/format";
import { usePosStore, type CartItem, type ProductCartItem, type ServiceCartItem } from "@/store/posStore";
import type { Product } from "@/api/products";
import styles from "../../../pages/pos/Pos.module.css";

interface PosCartTableProps {
  cart: CartItem[];
  products: Product[];
  addingToService: string | null;
  serviceProductSearch: string;
  onSetQty: (item: CartItem, newQty: number) => boolean;
  onDelete: (id: string) => void;
  onAddingToService: (id: string | null) => void;
  onServiceProductSearch: (v: string) => void;
  onAddServiceProduct: (serviceId: string, product: Product, qty: number) => boolean;
  onUpdateServiceProductQty: (serviceId: string, productId: string, qty: number) => boolean;
  showAlert: (msg: string) => void;
  readOnly?: boolean;
}

export function PosCartTable({
  cart, products, addingToService, serviceProductSearch,
  onSetQty, onDelete, onAddingToService, onServiceProductSearch,
  onAddServiceProduct, onUpdateServiceProductQty, showAlert, readOnly = false,
}: PosCartTableProps) {
  const currency = usePosStore((s) => s.currency);

  if (cart.length === 0) {
    return (
      <div className={styles.emptyCart}>
        <ScanBarcode size={40} className={styles.emptyCartIcon} />
        <span>Escanea un producto o busca un servicio</span>
      </div>
    );
  }

  function getItemPrice(item: CartItem): number {
    if (item._type === "product") return item.price;
    const svc = item as ServiceCartItem;
    const additivePerInstance = svc.products
      .filter((sp) => sp.affects_price)
      .reduce((sum, sp) => sum + sp.unit_price * sp.quantity, 0);
    return svc.base_price + additivePerInstance;
  }

  function getItemSubtotal(item: CartItem): number {
    return getItemPrice(item) * item.quantity;
  }

  return (
    <table className={styles.cartTable}>
      <thead className={styles.tableHead}>
        <tr>
          <th className={styles.thLeft}>Producto / Servicio</th>
          <th className={styles.thCenter}>Cantidad</th>
          <th className={styles.thRight}>Precio</th>
          <th className={styles.thRight}>Subtotal</th>
          {!readOnly && <th className={styles.thAction}></th>}
        </tr>
      </thead>
      <tbody className={styles.tableBody}>
        {cart.map((x) => (
          <tr key={x.id}>
            <td className={styles.tdProduct}>
              <div className={styles.productName}>
                {x._type === "service" && <Wrench size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle", opacity: 0.5 }} />}
                {x.name}
              </div>
              {x._type === "product" && (x as ProductCartItem).barcode && (
                <div className={styles.productBarcode}>{(x as ProductCartItem).barcode}</div>
              )}
              {x._type === "service" && !readOnly && (
                <ServiceProductManager
                  svc={x as ServiceCartItem}
                  products={products}
                  addingToService={addingToService}
                  serviceProductSearch={serviceProductSearch}
                  onAddingToService={onAddingToService}
                  onServiceProductSearch={onServiceProductSearch}
                  onAddServiceProduct={onAddServiceProduct}
                  onUpdateServiceProductQty={onUpdateServiceProductQty}
                  showAlert={showAlert}
                />
              )}
            </td>
            <td className={styles.tdQty}>
              {readOnly ? (
                <span className={styles.qtyValue}>{x.quantity}</span>
              ) : (
                <QtyInputCell
                  value={x.quantity}
                  min={1}
                  onUpdate={(qty) => onSetQty(x, qty)}
                  ariaLabel="Cantidad"
                  className={styles.qtyInput}
                />
              )}
            </td>
            <td className={styles.tdRight}>{money(getItemPrice(x), currency)}</td>
            <td className={styles.tdRightBold}>{money(getItemSubtotal(x), currency)}</td>
            {!readOnly && (
              <td className={styles.tdAction}>
                <button onClick={() => onDelete(x.id)} className={styles.deleteBtn}>
                  <Trash2 size={14} />
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}



interface ServiceProductManagerProps {
  svc: ServiceCartItem;
  products: Product[];
  addingToService: string | null;
  serviceProductSearch: string;
  onAddingToService: (id: string | null) => void;
  onServiceProductSearch: (v: string) => void;
  onAddServiceProduct: (serviceId: string, product: Product, qty: number) => boolean;
  onUpdateServiceProductQty: (serviceId: string, productId: string, qty: number) => boolean;
  showAlert: (msg: string) => void;
}

function ServiceProductManager({
  svc, products, addingToService, serviceProductSearch,
  onAddingToService, onServiceProductSearch, onAddServiceProduct, onUpdateServiceProductQty, showAlert,
}: ServiceProductManagerProps) {
  const toggleServiceProductAffectsPrice = usePosStore((s) => s.toggleServiceProductAffectsPrice);
  const removeServiceProduct = usePosStore((s) => s.removeServiceProduct);
  const currency = usePosStore((s) => s.currency);

  return (
    <div className={styles.serviceProducts}>
      <div className={styles.serviceBasePrice}>Base: {money(svc.base_price, currency)}</div>
      {svc.products.map((sp) => (
        <div key={sp.product_id} className={styles.serviceProductItem}>
          <span className={styles.spName}>{sp.product_name}</span>
          <div className={styles.spControls}>
            <button
              onClick={() => toggleServiceProductAffectsPrice(svc.service_id, sp.product_id)}
              className={`${styles.spPriceToggle} ${sp.affects_price ? styles.spPriceToggleOn : ""}`}
              title={sp.affects_price ? "Suma al precio" : "No suma al precio"}
            >
              $
            </button>
            <QtyInputCell
              value={sp.quantity}
              min={1}
              onUpdate={(qty) => onUpdateServiceProductQty(svc.service_id, sp.product_id, qty)}
              ariaLabel={`Cantidad de ${sp.product_name}`}
              className={styles.spQtyInput}
            />
            <button
              onClick={() => removeServiceProduct(svc.service_id, sp.product_id)}
              className={styles.spRemoveBtn}
              title="Quitar producto"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      ))}
      <div className={styles.serviceProductAdd}>
        {addingToService === svc.service_id ? (
          <div className={styles.spAddPopover}>
            <input
              value={serviceProductSearch}
              onChange={(e) => onServiceProductSearch(e.target.value)}
              placeholder="Buscar producto..."
              className={styles.spAddInput}
              autoFocus
            />
            <div className={styles.spAddResults}>
              {products
                .filter(
                  (p) =>
                    p.active &&
                    !svc.products.find((sp) => sp.product_id === p.id) &&
                    (serviceProductSearch === "" ||
                      p.name.toLowerCase().includes(serviceProductSearch.toLowerCase()))
                )
                .slice(0, 8)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.spAddResultItem}
                    onClick={() => {
                      if (p.stock <= 0) {
                        showAlert(`"${p.name}" no tiene stock disponible`);
                        return;
                      }
                      if (!onAddServiceProduct(svc.service_id, p, 1)) return;
                      onServiceProductSearch("");
                      onAddingToService(null);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              {products.filter(
                (p) =>
                  p.active &&
                  !svc.products.find((sp) => sp.product_id === p.id) &&
                  (serviceProductSearch === "" ||
                    p.name.toLowerCase().includes(serviceProductSearch.toLowerCase()))
              ).length === 0 && (
                  <div className={styles.spAddEmpty}>Sin resultados</div>
                )}
            </div>
            <button
              type="button"
              className={styles.spAddCancel}
              onClick={() => { onAddingToService(null); onServiceProductSearch(""); }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.spAddBtn}
            onClick={() => onAddingToService(svc.service_id)}
          >
            <PackagePlus size={12} /> Agregar producto
          </button>
        )}
      </div>
    </div>
  );
}

function QtyInputCell({
  value,
  min,
  onUpdate,
  ariaLabel,
  className,
}: {
  value: number;
  min: number;
  onUpdate: (qty: number) => boolean | void;
  ariaLabel: string;
  className: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <input
      type="number"
      min={min}
      inputMode="numeric"
      value={draft}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === "") {
          setDraft(String(min));
          onUpdate(min);
          return;
        }
        const n = Number(draft);
        if (!Number.isFinite(n)) {
          setDraft(String(value));
          return;
        }
        const result = onUpdate(Math.max(min, n));
        if (result === false) {
          setDraft(String(value));
        }
      }}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
