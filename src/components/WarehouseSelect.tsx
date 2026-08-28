"use client";

import { useEffect, useState } from "react";

export type WarehouseOption = {
  id: string;
  name: string;
};

export function WarehouseSelect({
  value,
  onChange,
  label = "Склад",
  placeholder = "Выберите склад",
  allowEmpty = true,
  disabled = false,
}: {
  value: string | null;
  onChange: (warehouseId: string | null, warehouse?: WarehouseOption | null) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouses");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить склады");
      setWarehouses(data.warehouses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createWarehouse() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось создать склад");
      const warehouse = data.warehouse as WarehouseOption;
      setWarehouses((prev) => {
        if (prev.some((w) => w.id === warehouse.id)) return prev;
        return [...prev, warehouse].sort((a, b) => a.name.localeCompare(b.name, "ru"));
      });
      onChange(warehouse.id, warehouse);
      setNewName("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeWarehouse(id: string) {
    const wh = warehouses.find((w) => w.id === id);
    if (!wh) return;
    if (!window.confirm(`Удалить склад «${wh.name}»?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось удалить склад");
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
      if (value === id) onChange(null, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{label}</span>
        <select
          className="field"
          value={value ?? ""}
          disabled={disabled || loading || busy}
          onChange={(e) => {
            const id = e.target.value || null;
            const wh = warehouses.find((w) => w.id === id) || null;
            onChange(id, wh);
          }}
        >
          {allowEmpty ? <option value="">{placeholder}</option> : null}
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {!adding ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setAdding(true)}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface)] disabled:opacity-60"
          >
            + Добавить склад
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createWarehouse();
                }
              }}
              className="field !w-auto min-w-[160px] py-1 text-sm"
              placeholder="Название склада"
              autoFocus
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={() => void createWarehouse()}
              className="rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs font-medium text-[#1a1a1a] disabled:opacity-60"
            >
              Создать
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs"
            >
              Отмена
            </button>
          </div>
        )}

        {value ? (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void removeWarehouse(value)}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[#c62828] hover:bg-[#fdeceb] disabled:opacity-60"
          >
            Удалить выбранный
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">Загрузка складов…</p>
      ) : null}
      {error ? <p className="text-sm text-[#c62828]">{error}</p> : null}
    </div>
  );
}
