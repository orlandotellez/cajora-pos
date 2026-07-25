import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { settingsApi, type UpdateSettingsPayload } from "@/api/settings";
import { useAuth } from "@/context/AuthContext";
import { CURRENCIES } from "@/lib/constants";
import type { CurrencyCode } from "@/lib/constants";
import { setStoredCurrency } from "@/lib/format";
import { usePosStore } from "@/store/posStore";
import styles from "./Settings.module.css";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/pos", { replace: true });
    }
  }, [user, navigate]);

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
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Cargando configuración…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Ajustes</h1>
          <p className={styles.subtitle}>Datos del negocio y configuración general</p>
        </div>
      </header>

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

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Stock mínimo por defecto</label>
            <input
              type="number"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })}
              className={styles.input}
            />
          </div>
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
    </div>
  );
}
