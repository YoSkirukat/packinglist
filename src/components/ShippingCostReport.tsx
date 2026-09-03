"use client";

import { useState } from "react";
import { WarehouseSelect } from "@/components/WarehouseSelect";
import { SecondaryButton } from "@/components/ui-client";
import { formatNumber } from "@/lib/format";
import type { ShippingCostExportRow } from "@/lib/shipping-cost-export";

type ReportResult = {
  transferCount: number;
  unitCost: number;
  productCount: number;
  totalQty: number;
  totalCost: number;
  exportRows: ShippingCostExportRow[];
};

function moneyDigits(value: number) {
  return value % 1 === 0 ? 0 : 2;
}

function qtyDigits(value: number) {
  return value % 1 === 0 ? 0 : 3;
}

export function ShippingCostReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState<string | null>(null);
  const [toWarehouseId, setToWarehouseId] = useState<string | null>(null);
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!dateFrom || !dateTo) {
      setError("Укажите период дат");
      return;
    }
    if (!fromWarehouseId || !toWarehouseId) {
      setError("Укажите склад-отправитель и склад-получатель");
      return;
    }
    const cost = Number(unitCost.replace(",", "."));
    if (!Number.isFinite(cost) || cost < 0) {
      setError("Укажите стоимость обработки одной единицы");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reports/shipping-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          fromWarehouseId,
          toWarehouseId,
          unitCost: cost,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сформировать отчёт");
      setResult(data as ReportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={generate} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Дата с</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="field"
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Дата по</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="field"
              disabled={loading}
            />
          </label>
          <WarehouseSelect
            value={fromWarehouseId}
            onChange={setFromWarehouseId}
            label="Склад-отправитель"
            placeholder="Выберите склад"
            allowEmpty
            disabled={loading}
          />
          <WarehouseSelect
            value={toWarehouseId}
            onChange={setToWarehouseId}
            label="Склад-получатель"
            placeholder="Выберите склад"
            allowEmpty
            disabled={loading}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="block max-w-xs flex-1">
            <span className="mb-1.5 block text-sm font-medium">
              Стоимость обработки одной единицы, ₽
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="field"
              placeholder="Например, 15"
              disabled={loading}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
          >
            {loading ? "Формирование…" : "Сформировать"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-[#c62828]">{error}</p> : null}

      {result ? (
        <div className="space-y-4">
          {result.transferCount === 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm">
              <div className="font-medium">Нет данных</div>
              <p className="mt-1 text-[var(--muted)]">
                За выбранный период и склады перемещений не найдено.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm leading-7">
              <div>
                Перемещений за период: {formatNumber(result.transferCount)} шт.
              </div>
              <div>
                Тариф:{" "}
                {formatNumber(result.unitCost, moneyDigits(result.unitCost))} ₽/шт
              </div>
              <div>
                Количество товаров: {formatNumber(result.productCount)} шт.
              </div>
              <div>
                Количество единиц товара:{" "}
                {formatNumber(result.totalQty, qtyDigits(result.totalQty))} шт.
              </div>
              <div className="font-medium">
                Итого отправлено товаров на сумму:{" "}
                {formatNumber(result.totalCost, moneyDigits(result.totalCost))}{" "}
                руб.
              </div>
            </div>
          )}

          {result.exportRows.length > 0 ? (
            <SecondaryButton
              type="button"
              onClick={() =>
                void import("@/lib/shipping-cost-export").then(
                  ({ exportShippingCostToExcel }) =>
                    exportShippingCostToExcel(
                      result.exportRows,
                      dateFrom,
                      dateTo,
                    ),
                )
              }
            >
              Экспорт в Excel
            </SecondaryButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
