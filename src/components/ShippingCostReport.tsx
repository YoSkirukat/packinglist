"use client";

import { useState } from "react";
import { WarehouseSelect } from "@/components/WarehouseSelect";
import { ProductPhotoPreview } from "@/components/ProductPhotoPreview";
import { formatNumber } from "@/lib/format";

type ReportItem = {
  key: string;
  productName: string;
  productCode: string;
  productArticle: string;
  qty: number;
  cost: number;
  photoUrl: string | null;
};

type ReportResult = {
  transferCount: number;
  unitCost: number;
  items: ReportItem[];
  totalQty: number;
  totalCost: number;
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
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Перемещений за период: {formatNumber(result.transferCount)} · тариф{" "}
            {formatNumber(result.unitCost, moneyDigits(result.unitCost))} ₽/шт
          </p>

          {result.items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-base font-medium">Нет данных</div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                За выбранный период и склады перемещений не найдено.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="w-16">Фото</th>
                    <th>Наименование</th>
                    <th className="w-28">Кол-во</th>
                    <th className="w-36">Стоимость</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.key}>
                      <td>
                        {item.photoUrl ? (
                          <ProductPhotoPreview
                            src={item.photoUrl}
                            alt={item.productName}
                          />
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {[item.productCode, item.productArticle]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="col-center">
                        {formatNumber(item.qty, qtyDigits(item.qty))}
                      </td>
                      <td className="col-center">
                        {formatNumber(item.cost, moneyDigits(item.cost))} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="font-semibold">
                      Итого
                    </td>
                    <td className="col-center font-semibold">
                      {formatNumber(result.totalQty, qtyDigits(result.totalQty))} шт
                    </td>
                    <td className="col-center font-semibold">
                      {formatNumber(
                        result.totalCost,
                        moneyDigits(result.totalCost),
                      )}{" "}
                      ₽
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
