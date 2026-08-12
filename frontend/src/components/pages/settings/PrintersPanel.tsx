import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { printersApi } from "@/api/printers";
import type {
  Printer,
  CreatePrinterPayload,
} from "@/api/printers";
import { sendBytesToPrinter } from "@/lib/tcp-printer";
import { isTauriRuntime } from "@/lib/fetch";
import { useModalBack } from "@/hooks/useModalBack";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ApiError } from "@/api/client";
import { useToast } from "@/components/common/ui/Toast";
import styles from "./PrintersPanel.module.css";

const DEFAULT_FORM: CreatePrinterPayload = {
  name: "",
  connection_type: "net",
  address: "",
  port: 9100,
  role: "receipt",
  paper_width: 80,
  profile: "escpos",
  codepage: "ISO-8859-1",
  auto_cut: true,
  cut_type: "full",
  open_cash_drawer: false,
  default_copies: 1,
  is_default: false,
  is_active: true,
};

function buildPayload(form: CreatePrinterPayload, isNet: boolean): CreatePrinterPayload {
  const { is_default: _isDefault, ...rest } = form;
  const base: CreatePrinterPayload = { ...rest };
  if (!isNet) {
    base.port = null;
  } else if (typeof base.port === "string") {
    base.port = Number(base.port);
  }
  return base;
}

function isValidIPv4(s: string): boolean {
  return /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/.test(s);
}

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

export default function PrintersPanel() {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePrinterPayload>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Botón de retroceso de Android / gesto de regreso cierra los modales de
  // impresora (formulario y confirmación de borrado) en vez de navegar atrás.
  useModalBack(() => setFormOpen(false), formOpen);
  useModalBack(() => setDeletingId(null), deletingId !== null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    cancelledRef.current = false;
    loadPrinters();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function loadPrinters() {
    setLoading(true);
    try {
      const res = await printersApi.list();
      if (cancelledRef.current) return;
      setPrinters(res.printers);
    } catch (err) {
      if (cancelledRef.current) return;
      toast(`Error al cargar impresoras: ${(err as ApiError).message}`, "error");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!debounced) return printers;
    return printers.filter(
      (p) =>
        p.name.toLowerCase().includes(debounced) ||
        p.address.toLowerCase().includes(debounced) ||
        p.role.toLowerCase().includes(debounced)
    );
  }, [printers, debounced]);

  function openCreate() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(p: Printer) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      connection_type: p.connection_type,
      address: p.address,
      port: p.port ?? 9100,
      role: p.role,
      paper_width: p.paper_width === 58 ? 58 : 80,
      profile: p.profile,
      codepage: p.codepage,
      auto_cut: p.auto_cut,
      cut_type: p.cut_type,
      open_cash_drawer: p.open_cash_drawer,
      default_copies: p.default_copies,
      is_default: p.is_default,
      is_active: p.is_active,
    });
    setError(null);
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const isNet = form.connection_type === "net";

    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    const trimmedName = form.name.trim();
    const duplicate = printers.find(
      (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase() && p.id !== editingId
    );
    if (duplicate) {
      setError(`Ya existe una impresora llamada "${trimmedName}"`);
      return;
    }
    if (isNet && !isValidIPv4(form.address)) {
      setError("La dirección IP no es válida");
      return;
    }
    if (!isNet && !form.address.trim()) {
      setError("La dirección es obligatoria para USB/Bluetooth");
      return;
    }

    const payload = buildPayload(form, isNet);
    setBusy(true);
    try {
      if (editingId) {
        const updated = await printersApi.update(editingId, payload);
        setPrinters((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setFormOpen(false);
        toast(`Impresora "${updated.name}" actualizada`, "success");
      } else {
        const created = await printersApi.create(payload);
        if (cancelledRef.current) return;
        setPrinters((prev) => [...prev, created]);
        setFormOpen(false);
        toast(`Impresora "${created.name}" creada`, "success");
      }
    } catch (err) {
      toast((err as ApiError).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runTestPrint(id: string) {
    setBusy(true);
    try {
      const res = await printersApi.testPrint(id, 1);
      if (!res.ticket_base64 || !res.printer) {
        toast("El servidor no generó el ticket de prueba", "error");
        return;
      }

      if (isTauriRuntime()) {
        // Tauri (desktop/Android): envía TCP directo desde el dispositivo
        const tcpResult = await sendBytesToPrinter(
          res.ticket_base64,
          res.printer.address,
          res.printer.port,
        );

        if (tcpResult.success) {
          toast(`Test exitoso: ${tcpResult.bytes_sent} bytes en ${tcpResult.duration_ms}ms`, "success");
        } else {
          toast(tcpResult.error || "Falló la conexión con la impresora", "error");
        }
      } else {
        // Web: envía TCP proxeado por el backend. Si la conexión falla el backend
        // responde !ok (502) y client.ts lanza ApiError → cae al catch de abajo.
        const proxyResult = await printersApi.sendTcp(
          res.ticket_base64,
          res.printer.address,
          res.printer.port,
        );

        toast(`Test exitoso: ${proxyResult.bytes_sent} bytes en ${proxyResult.duration_ms}ms`, "success");
      }
    } catch (err) {
      toast(`Test falló: ${(err as ApiError).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    setBusy(true);
    try {
      await printersApi.delete(deletingId);
      setPrinters((prev) => prev.filter((p) => p.id !== deletingId));
      setDeletingId(null);
      toast("Impresora eliminada", "success");
    } catch (err) {
      toast(`Error al eliminar: ${(err as ApiError).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function setAsDefault(id: string) {
    setBusy(true);
    try {
      const updated = await printersApi.setDefault(id, "receipt");
      setPrinters((prev) => prev.map((p) =>
        p.id === updated.id
          ? updated
          : { ...p, is_default: false }
      ));
      toast(`"${updated.name}" ahora es la impresora predeterminada`, "success");
    } catch (err) {
      toast(`Error: ${(err as ApiError).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  const deletingTarget = printers.find((p) => p.id === deletingId);

  const columns: Column<Printer>[] = [
    {
      key: "star",
      label: "",
      width: "28px",
      render: (p) =>
        p.is_default ? <span title="Impresora predeterminada">★</span> : null,
    },
    { key: "name", label: "Nombre", render: (p) => p.name },
    {
      key: "connection",
      label: "Conexión",
      render: (p) =>
        p.connection_type === "net"
          ? `Red ${p.address}:${p.port ?? "?"}`
          : p.connection_type === "usb"
            ? `USB ${p.address}`
            : `Bluetooth ${p.address}`,
    },
    {
      key: "role",
      label: "Rol",
      width: "80px",
      render: (p) =>
        p.role === "receipt" ? "Recibo" : p.role === "kitchen" ? "Cocina" : "Ambos",
    },
    {
      key: "width",
      label: "Ancho",
      width: "70px",
      render: (p) => `${p.paper_width}mm`,
    },
    {
      key: "status",
      label: "Estado",
      width: "80px",
      render: (p) =>
        p.is_active ? (
          <span className={styles.badgeOk}>activa</span>
        ) : (
          <span className={styles.badgeOff}>inactiva</span>
        ),
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.actions}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="search"
            placeholder="Buscar por nombre, IP o rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          + Nueva impresora
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        total={printers.length}
        page={1}
        totalPages={1}
        onPageChange={() => { }}
        onRowClick={openEdit}
        onEdit={openEdit}
        onDelete={(p) => setDeletingId(p.id)}
        emptyMessage={
          printers.length === 0
            ? "Aún no hay impresoras configuradas."
            : "Ningún resultado coincide con tu búsqueda."
        }
      />

      {formOpen && (
        <div className={styles.overlay} onClick={() => setFormOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingId ? "Editar impresora" : "Nueva impresora"}
              </h2>
              <button onClick={() => setFormOpen(false)} className={styles.modalClose}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitForm} className={styles.modalForm}>
              <div className={styles.grid}>
                <Field label="Nombre">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="Caja 1"
                  />
                </Field>
                <Field label="Rol">
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as CreatePrinterPayload["role"] })
                    }
                  >
                    <option value="receipt">Recibo de venta</option>
                  </select>
                </Field>
                <Field label="Tipo de conexión">
                  <select
                    value={form.connection_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        connection_type: e.target.value as CreatePrinterPayload["connection_type"],
                      })
                    }
                  >
                    <option value="net">Red (Ethernet / WiFi)</option>
                    <option value="usb">USB</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                </Field>
                <Field
                  label={
                    form.connection_type === "net"
                      ? "Dirección IP"
                      : "Dirección / dispositivo"
                  }
                >
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    required
                    placeholder={
                      form.connection_type === "net"
                        ? "192.168.1.100"
                        : form.connection_type === "usb"
                          ? "/dev/usb/lp0"
                          : "AA:BB:CC:DD:EE:FF"
                    }
                  />
                </Field>
                {form.connection_type === "net" && (
                  <Field label="Puerto">
                    <input
                      type="number"
                      value={form.port ?? 9100}
                      onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                      onFocus={selectOnFocus}
                      min={1}
                      max={65535}
                      placeholder="9100"
                    />
                  </Field>
                )}
                <Field label="Ancho de papel">
                  <select
                    value={form.paper_width}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paper_width: Number(e.target.value) as CreatePrinterPayload["paper_width"],
                      })
                    }
                  >
                    <option value={58}>58 mm</option>
                    <option value={80}>80 mm</option>
                  </select>
                </Field>
                <Field label="Perfil">
                  <select
                    value={form.profile}
                    onChange={(e) =>
                      setForm({ ...form, profile: e.target.value as CreatePrinterPayload["profile"] })
                    }
                  >
                    <option value="escpos">ESC/POS (Epson y compatible)</option>
                    <option value="star_line">Star Line Mode</option>
                  </select>
                </Field>
                <Field label="Codepage">
                  <select
                    value={form.codepage}
                    onChange={(e) => setForm({ ...form, codepage: e.target.value })}
                  >
                    <option value="CP850">CP850 (español)</option>
                    <option value="CP858">CP858 (español + €)</option>
                    <option value="CP1252">CP1252 (Windows Latin-1)</option>
                    <option value="ISO-8859-1">ISO-8859-1</option>
                  </select>
                </Field>
                {form.auto_cut && (
                  <Field label="Tipo de corte">
                    <select
                      value={form.cut_type ?? "full"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          cut_type: e.target.value as CreatePrinterPayload["cut_type"],
                        })
                      }
                    >
                      <option value="full">Total</option>
                      <option value="partial">Parcial</option>
                    </select>
                  </Field>
                )}
                <Field label="Copias por defecto">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.default_copies}
                    onChange={(e) => setForm({ ...form, default_copies: Number(e.target.value) })}
                    onFocus={selectOnFocus}
                  />
                </Field>
                <Field label="Activa">
                  <select
                    value={form.is_active ? "true" : "false"}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.value === "true" })
                    }
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </Field>
              </div>

              {error && <div className={styles.toastError}>{error}</div>}

              {editingId && (
                <div className={styles.drawerActionsRow}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => runTestPrint(editingId)}
                    disabled={busy}
                    title={
                      form.connection_type === "net"
                        ? undefined
                        : "Probar impresión solo para impresoras de red"
                    }
                  >
                    Probar impresión
                  </button>
                  {!form.is_default && (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setAsDefault(editingId)}
                      disabled={busy}
                    >
                      Marcar predeterminada
                    </button>
                  )}
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setFormOpen(false)}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={busy}>
                  {busy ? "Guardando…" : editingId ? "Guardar cambios" : "Crear impresora"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && deletingTarget && (
        <div className={styles.overlay} onClick={() => setDeletingId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Eliminar impresora</h2>
              <button onClick={() => setDeletingId(null)} className={styles.modalClose}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>
                ¿Eliminar <strong>{deletingTarget.name}</strong>? Esta acción no se puede
                deshacer.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setDeletingId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.primaryBtn} ${styles.btnDangerBg}`}
                onClick={confirmDelete}
                disabled={busy}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
