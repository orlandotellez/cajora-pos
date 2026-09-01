import { useState, useCallback } from "react";
import Papa from "papaparse";
import { Download, FileUp, X, Upload } from "lucide-react";
import styles from "./ImportCsvModal.module.css";
import { productsApi, type ImportProductRow } from "@/api/products";
import { UNIT_TYPE_GROUPS, UNIT_TYPE_LABELS, needsUnitQuantity } from "@/lib/constants";
import { useModalBack } from "@/hooks/useModalBack";

const VALID_UNIT_TYPES = Object.keys(UNIT_TYPE_LABELS);

function normalizeUnitType(value: string): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (VALID_UNIT_TYPES.includes(lower)) return lower;
  if (lower === "galones") return "galon";
  if (lower === "botellas") return "botella";
  if (lower === "latas") return "lata";
  if (lower === "sobres") return "sobre";
  if (lower === "barras") return "barra";
  if (lower === "rollos") return "rollo";
  if (lower === "unidades") return "unidad";
  if (lower === "paquetes") return "paquete";
  if (lower === "cajas") return "caja";
  if (lower === "bolsas") return "bolsa";
  if (lower === "ristras") return "ristra";
  return undefined;
}

const CSV_HEADERS = [
  "name",
  "barcode",
  "unit_type",
  "unit_quantity",
  "price",
  "cost",
  "stock",
  "low_stock_threshold",
  "category",
  "supplier",
];

const SAMPLE_ROWS: string[][] = [
  ["Coca-Cola 1.5L", "7790895000998", "botella", "", "3200", "2400", "50", "10", "Bebidas", "Coca-Cola FEMSA"],
  ["Harina 0000 1kg", "", "paquete", "1", "1800", "1300", "30", "5", "Almacén", "Molino"],
];

function buildTemplateCsv(): string {
  const rows = [
    CSV_HEADERS.join(","),
    ...SAMPLE_ROWS.map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",")),
  ];
  return rows.join("\n");
}

type PreviewRow = {
  row: number;
  data: ImportProductRow;
  error: string | null;
};

interface ImportCsvModalProps {
  setOpen: () => void;
  onImported: () => void;
}

export const ImportCsvModal = ({ setOpen, onImported }: ImportCsvModalProps) => {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);

  useModalBack(setOpen);

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-productos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toNumber = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(String(v).trim().replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const parseFile = useCallback((file: File) => {
    setFileName(file.name);
    setResult(null);
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data as string[][];
        if (rows.length === 0) {
          setPreview([]);
          setParsed(true);
          return;
        }
        const header = rows[0].map((h) => String(h).trim());
        const indices: Record<string, number> = {};
        CSV_HEADERS.forEach((h) => {
          const idx = header.indexOf(h);
          if (idx !== -1) indices[h] = idx;
        });
        const nameIdx = indices["name"];
        const rowsData: PreviewRow[] = [];
        if (nameIdx === undefined) {
          rowsData.push({ row: 1, data: { name: "", price: 0 }, error: "Fila de encabezados inválida: falta la columna 'name'" });
        } else {
          for (let i = 1; i < rows.length; i++) {
            const raw = rows[i];
            const cell = (h: string) => {
              const idx = indices[h];
              return idx === undefined ? "" : String(raw[idx] ?? "").trim();
            };
            const rowNum = i + 1;
            const rawUnitType = cell("unit_type");
            const unitType = normalizeUnitType(rawUnitType);
            const unitQty = toNumber(cell("unit_quantity"));
            const priceNum = toNumber(cell("price"));
            const priceOk = priceNum !== undefined && !Number.isNaN(priceNum);
            const row: ImportProductRow = {
              name: cell("name"),
              barcode: cell("barcode") || undefined,
              unit_type: unitType || undefined,
              unit_quantity: unitQty,
              price: priceOk ? priceNum! : 0,
              cost: toNumber(cell("cost")),
              stock: toNumber(cell("stock")),
              low_stock_threshold: toNumber(cell("low_stock_threshold")),
              category_name: cell("category") || undefined,
              supplier_name: cell("supplier") || undefined,
            };
            let error: string | null = null;
            if (!row.name) error = "Falta el nombre";
            else if (!priceOk) error = "El precio es requerido y debe ser numérico";
            else if (rawUnitType && !unitType) error = `Tipo de empaque inválido: '${rawUnitType}'`;
            else if (unitType && needsUnitQuantity(unitType) && (unitQty === undefined || Number.isNaN(unitQty) || unitQty < 2))
              error = `El empaque '${unitType}' requiere unit_quantity entero ≥ 2`;
            rowsData.push({ row: rowNum, data: row, error });
          }
        }
        setPreview(rowsData);
        setParsed(true);
      },
    });
  }, []);

  const validRows = preview.filter((r) => !r.error);
  const invalidCount = preview.length - validRows.length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  async function handleImport() {
    setSubmitting(true);
    try {
      const res = await productsApi.importCsv(validRows.map((r) => r.data));
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (err) {
      setResult({ imported: 0, errors: [{ row: 0, message: (err as Error)?.message || "Error al importar" }] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={setOpen}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Importar productos</h2>
          <button onClick={setOpen} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {!parsed && !result && (
            <>
              <button type="button" onClick={downloadTemplate} className={styles.templateBtn}>
                <Download size={16} /> Descargar plantilla CSV
              </button>
              <label
                className={styles.dropzone}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.fileInput}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) parseFile(f);
                  }}
                />
                <FileUp size={28} />
                <p className={styles.dropText}>Arrastrá tu archivo CSV acá o</p>
                <span className={styles.dropLink}>seleccioná un archivo</span>
                <div className={styles.columnsHelp}>
                  <span className={styles.columnsTitle}>Columnas:</span>
                  <span className={styles.columnsList}>name, barcode, unit_type, unit_quantity, price, cost, stock, low_stock_threshold, category, supplier</span>
                </div>
              </label>
              <div className={styles.unitHelp}>
                <span className={styles.unitHelpTitle}>Tipos de empaque permitidos en la columna <code>unit_type</code>:</span>
                {UNIT_TYPE_GROUPS.map((group) => (
                  <div key={group.label} className={styles.unitGroup}>
                    <span className={styles.unitGroupLabel}>{group.label}</span>
                    <div className={styles.unitGroupTags}>
                      {group.types.map((t) => (
                        <span key={t} className={styles.unitTag}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {result && (
            <div className={styles.result}>
              <div className={styles.resultIcon}>
                <Upload size={28} />
              </div>
              <h3 className={styles.resultTitle}>Importación finalizada</h3>
              <p className={styles.resultCount}>
                <strong>{result.imported}</strong> producto{result.imported === 1 ? "" : "s"} importado{result.imported === 1 ? "" : "s"}
              </p>
              {result.errors.length > 0 && (
                <div className={styles.resultErrors}>
                  {result.errors.map((err, i) => (
                    <div key={i} className={styles.resultError}>
                      {err.row > 0 ? `Fila ${err.row}: ` : ""}{err.message}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={setOpen} className={styles.primaryBtn}>Listo</button>
            </div>
          )}

          {parsed && !result && (
            <>
              <div className={styles.summary}>
                <span className={styles.fileName}>{fileName}</span>
                <span className={invalidCount > 0 ? styles.badgeError : styles.badgeOk}>
                  {validRows.length} válidas / {invalidCount} con error
                </span>
                <button type="button" onClick={() => { setParsed(false); setPreview([]); setFileName(""); }} className={styles.repick}>
                  Elegir otro
                </button>
              </div>
              <div className={styles.preview}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Nombre</th>
                      <th>Precio</th>
                      <th>Categoría</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.row} className={r.error ? styles.rowError : undefined}>
                        <td>{r.row}</td>
                        <td>{r.data.name}</td>
                        <td>{r.data.price}</td>
                        <td>{r.data.category_name || "—"}</td>
                        <td>{r.error ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.actions}>
                <button onClick={handleImport} className={styles.primaryBtn} disabled={submitting || validRows.length === 0}>
                  {submitting ? "Importando…" : `Importar ${validRows.length} producto${validRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
