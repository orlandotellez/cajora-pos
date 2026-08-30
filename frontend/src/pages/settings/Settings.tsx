import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { settingsApi, type UpdateSettingsPayload } from "@/api/settings";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useSettingsStore } from "@/store/settingsStore";
import PrintersPanel from "@/components/pages/settings/PrintersPanel";
import { CURRENCIES } from "@/lib/constants";
import type { CurrencyCode } from "@/lib/constants";
import { setStoredCurrency } from "@/lib/format";
import { usePosStore } from "@/store/posStore";
import styles from "./Settings.module.css";

type SettingsTab = "general" | "printers";

const TAB_ORDER: SettingsTab[] = ["general", "printers"];
const TAB_ID = (t: SettingsTab) => `settings-tab-${t}`;
const PANEL_ID = (t: SettingsTab) => `settings-panel-${t}`;

export default function Settings() {
  useAdminGuard();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  function onTabsKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    const current = TAB_ORDER.indexOf(activeTab);
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % TAB_ORDER.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TAB_ORDER.length - 1;

    const tab = TAB_ORDER[next];
    setActiveTab(tab);
    requestAnimationFrame(() => {
      document.getElementById(TAB_ID(tab))?.focus();
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Ajustes</h1>
          <p className={styles.subtitle}>Datos del negocio y configuración general</p>
        </div>
      </header>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Secciones de ajustes"
        onKeyDown={onTabsKeyDown}
      >
        <button
          id={TAB_ID("general")}
          type="button"
          role="tab"
          aria-selected={activeTab === "general"}
          aria-controls={PANEL_ID("general")}
          tabIndex={activeTab === "general" ? 0 : -1}
          className={`${styles.tab}${activeTab === "general" ? ` ${styles.tabActive}` : ""}`}
          onClick={() => setActiveTab("general")}
        >
          Ajustes generales
        </button>
        <button
          id={TAB_ID("printers")}
          type="button"
          role="tab"
          aria-selected={activeTab === "printers"}
          aria-controls={PANEL_ID("printers")}
          tabIndex={activeTab === "printers" ? 0 : -1}
          className={`${styles.tab}${activeTab === "printers" ? ` ${styles.tabActive}` : ""}`}
          onClick={() => setActiveTab("printers")}
        >
          Impresoras
        </button>
      </div>

      <div
        id={PANEL_ID(activeTab)}
        role="tabpanel"
        aria-labelledby={TAB_ID(activeTab)}
        className={styles.tabPanel}
      >
        <div hidden={activeTab !== "general"}>
          <GeneralSettings />
        </div>
        <div hidden={activeTab !== "printers"}>
          <PrintersPanel />
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const posCurrency = usePosStore((s) => s.currency);
  const setCurrency = usePosStore((s) => s.setCurrency);
  const [currency, setLocalCurrency] = useState<CurrencyCode>(posCurrency);
  const [form, setForm] = useState<UpdateSettingsPayload>({
    name: "",
    address: "",
    phone: "",
    low_stock_threshold: 10,
    ticket_footer: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    settingsApi.get()
      .then((res) => {
        setForm({
          name: res.name ?? "",
          address: res.address ?? "",
          phone: res.phone ?? "",
          low_stock_threshold: res.low_stock_threshold,
          ticket_footer: res.ticket_footer ?? "",
        });
      })
      .catch((err) => console.warn("Error al cargar config:", err))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      setStoredCurrency(currency);
      setCurrency(currency);
      await settingsApi.update({
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        low_stock_threshold: form.low_stock_threshold,
        ticket_footer: form.ticket_footer || null,
      });
      setMessage("Datos guardados correctamente");
    } catch {
      setMessage("Error al guardar");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  if (loading) {
    return <p className={styles.loading}>Cargando configuración…</p>;
  }

  return (
    <>
      <form onSubmit={save} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Nombre del negocio</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={styles.input}
          required
          placeholder="Mi Negocio"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Dirección</label>
        <input
          value={form.address ?? ""}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Teléfono</label>
        <input
          value={form.phone ?? ""}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Moneda predeterminada</label>
        <select
          value={currency}
          onChange={(e) => setLocalCurrency(e.target.value as CurrencyCode)}
          className={styles.select}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Pie de página del ticket</label>
        <textarea
          rows={3}
          value={form.ticket_footer ?? ""}
          onChange={(e) => setForm({ ...form, ticket_footer: e.target.value })}
          placeholder="¡Gracias por su compra!"
          className={styles.textarea}
        />
      </div>

      {message && <p className={message.includes("Error") ? styles.error : styles.success}>{message}</p>}

      <button type="submit" className={styles.button} disabled={saving}>
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>

    <CashRegisterCard />
    </>
  );
}

function CashRegisterCard() {
  const enabled = useSettingsStore((s) => s.cashRegisterEnabled);
  const setEnabled = useSettingsStore((s) => s.setCashRegisterEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setSaving(true);
    setError("");
    try {
      await setEnabled(!enabled);
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el cambio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.moduleCard}>
      <div className={styles.moduleInfo}>
        <div className={styles.moduleTitle}>
          <Wallet size={18} />
          Activar caja
        </div>
        <p className={styles.moduleDesc}>
          Controlá el efectivo de cada turno: abrí y cerrá caja, registrá entradas
          y gastos en efectivo, y cuadrá las diferencias al cierre del día.
        </p>
        {error && <p className={styles.moduleError}>{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Activar módulo de caja"
        disabled={saving}
        onClick={toggle}
        className={`${styles.switch}${enabled ? ` ${styles.switchOn}` : ""}`}
      >
        <span className={styles.switchThumb} />
      </button>
    </div>
  );
}
