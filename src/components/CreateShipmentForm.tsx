"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WarehouseSelect } from "@/components/WarehouseSelect";

export function CreateShipmentForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [supplier, setSupplier] = useState("Китай");
  const [note, setNote] = useState("");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, supplier, note, warehouseId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось создать поставку");
      router.replace(`/shipments/${data.shipment.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Название поставки</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field"
          placeholder="Март 2026 · контейнер 1"
          required
          autoFocus
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Поставщик</span>
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="field"
        />
      </label>
      <WarehouseSelect
        value={warehouseId}
        onChange={setWarehouseId}
        label="Склад"
        placeholder="Не выбран"
        disabled={loading}
      />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Комментарий</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="field min-h-[90px] resize-y"
          placeholder="Номер инвойса, дата отгрузки, примечания"
        />
      </label>
      {error ? <p className="text-sm text-[#c62828]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
      >
        {loading ? "Создание…" : "Создать поставку"}
      </button>
    </form>
  );
}
