"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WarehouseSelect } from "@/components/WarehouseSelect";
import { LoadingOverlay } from "@/components/LoadingOverlay";

export function ShipmentWarehouseField({
  shipmentId,
  warehouseId,
}: {
  shipmentId: string;
  warehouseId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string | null>(warehouseId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function save(nextId: string | null) {
    setValue(nextId);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId: nextId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить склад");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setValue(warehouseId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md">
      {saving || isPending ? <LoadingOverlay label="Сохраняем склад..." /> : null}
      <WarehouseSelect
        value={value}
        onChange={(id) => void save(id)}
        label="Склад"
        placeholder="Не выбран"
        disabled={saving || isPending}
      />
      {error ? <p className="mt-1 text-sm text-[#c62828]">{error}</p> : null}
    </div>
  );
}
