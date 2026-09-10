"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { WarehouseSelect } from "@/components/WarehouseSelect";
import { ProductPhotoPreview } from "@/components/ProductPhotoPreview";
import { SecondaryButton, PrimaryButton } from "@/components/ui-client";
import { formatNumber } from "@/lib/format";
import {
  loadPendingTransfer,
  savePendingTransfer,
  clearPendingTransfer,
  type PendingTransferLine,
} from "@/lib/pending-transfer";

type StockCarton = {
  packingItemId: string;
  shipmentId: string;
  cartonNo: number;
  available: number;
  shipmentTitle: string;
};

type StockProduct = {
  key: string;
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName: string;
  availableTotal: number;
  cartonCount: number;
  photoUrl: string | null;
  cartons: StockCarton[];
};

function cartonKey(c: Pick<StockCarton, "packingItemId" | "cartonNo">) {
  return `${c.packingItemId}:${c.cartonNo}`;
}

function parseQty(text: string): number {
  const normalized = text.replace(",", ".").trim();
  if (normalized === "") return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatQtyInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(Math.round(value * 1e6) / 1e6);
}

function ProductNameCell({ product }: { product: StockProduct }) {
  const mapped =
    Boolean(product.productCode) ||
    Boolean(product.productArticle) ||
    (Boolean(product.supplierName) &&
      product.productName !== product.supplierName &&
      Boolean(product.productName));

  if (mapped) {
    return (
      <div>
        <div className="font-medium">{product.productName}</div>
        {product.productCode ? (
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            Код товара: {product.productCode}
          </div>
        ) : null}
        {product.productArticle ? (
          <div className="text-xs text-[var(--muted)]">
            Артикул: {product.productArticle}
          </div>
        ) : null}
        <div className="text-xs text-[var(--muted)]">
          Китайское название: {product.supplierName || "—"}
        </div>
      </div>
    );
  }

  return (
    <div className="font-medium">
      {product.productName || product.supplierName || "Без названия"}
    </div>
  );
}

function CartonsModal({
  product,
  onClose,
}: {
  product: StockProduct;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-cartons-title"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
        <div id="stock-cartons-title" className="text-sm font-semibold">
          Коробки · {product.productName || product.supplierName}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Остаток {formatNumber(product.availableTotal)} шт ·{" "}
          {formatNumber(product.cartonCount)} кор.
        </p>
        <ul className="mt-4 max-h-80 space-y-2 overflow-auto">
          {product.cartons.map((carton) => (
            <li
              key={cartonKey(carton)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span className="font-medium">{carton.cartonNo}</span>
              <span className="text-[var(--muted)]">
                {" "}
                ({formatNumber(carton.available)} шт)
              </span>
              <div className="mt-0.5 text-xs text-[var(--muted)]">
                Поставка «{carton.shipmentTitle}»
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm hover:bg-[var(--surface)]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AddToTransferModal({
  product,
  existing,
  onClose,
  onSave,
  onRemove,
}: {
  product: StockProduct;
  existing: PendingTransferLine | null;
  onClose: () => void;
  onSave: (line: PendingTransferLine) => void;
  onRemove: () => void;
}) {
  const [qtyText, setQtyText] = useState<string>(() =>
    existing ? formatQtyInput(existing.qty) : "",
  );
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        existing ? existing.cartons.map((c) => cartonKey(c)) : [],
      ),
  );
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const qty = parseQty(qtyText);
  const selectedCartons = product.cartons.filter((c) => selected.has(cartonKey(c)));
  const capacity = selectedCartons.reduce((sum, c) => sum + c.available, 0);

  const error =
    selected.size === 0
      ? "Выберите хотя бы одну коробку"
      : !Number.isFinite(qty) || qty <= 0
        ? "Укажите количество больше 0"
        : capacity + 1e-9 < qty
          ? `Недостаточно в выбранных коробках (доступно ${formatNumber(capacity)})`
          : null;

  function adjustQty(delta: number) {
    setQtyText((prev) => formatQtyInput(Math.max(0, parseQty(prev) + delta)));
  }

  function toggle(carton: StockCarton) {
    const key = cartonKey(carton);
    const checked = selected.has(key);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // Отмечая коробку, добавляем её остаток к количеству, снимая — вычитаем.
    // Пользователь всегда может потом поправить количество вручную.
    adjustQty(checked ? -carton.available : carton.available);
    setInteracted(true);
  }

  function selectAll() {
    const unselected = product.cartons.filter((c) => !selected.has(cartonKey(c)));
    if (unselected.length === 0) return;
    setSelected(new Set(product.cartons.map((c) => cartonKey(c))));
    adjustQty(unselected.reduce((sum, c) => sum + c.available, 0));
    setInteracted(true);
  }

  function clearAll() {
    if (selected.size === 0) return;
    const removed = product.cartons.filter((c) => selected.has(cartonKey(c)));
    setSelected(new Set());
    adjustQty(-removed.reduce((sum, c) => sum + c.available, 0));
    setInteracted(true);
  }

  function submit() {
    if (error) {
      setInteracted(true);
      return;
    }
    onSave({
      key: product.key,
      productId: product.productId,
      productName: product.productName,
      productCode: product.productCode,
      productArticle: product.productArticle,
      supplierName: product.supplierName,
      photoUrl: product.photoUrl,
      qty,
      cartons: selectedCartons,
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-transfer-title"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
        <div id="add-to-transfer-title" className="text-sm font-semibold">
          Добавить к перемещению · {product.productName || product.supplierName}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Остаток {formatNumber(product.availableTotal)} шт ·{" "}
          {formatNumber(product.cartonCount)} кор.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium">Количество</span>
          <input
            type="number"
            min={0.001}
            step="any"
            value={qtyText}
            onChange={(e) => {
              setQtyText(e.target.value);
              setInteracted(true);
            }}
            placeholder="0"
            className="field"
            autoFocus
          />
        </label>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">Коробки</span>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-[var(--link)] hover:underline"
              >
                Выбрать все
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[var(--link)] hover:underline"
              >
                Снять все
              </button>
            </div>
          </div>
          <ul className="max-h-60 space-y-1.5 overflow-auto">
            {product.cartons.map((carton) => {
              const key = cartonKey(carton);
              const checked = selected.has(key);
              return (
                <li key={key}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                      checked
                        ? "border-[var(--brand)] bg-[var(--surface)]"
                        : "border-[var(--border)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => toggle(carton)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{carton.cartonNo}</span>
                      <span className="text-[var(--muted)]">
                        {" "}
                        ({formatNumber(carton.available)} шт)
                      </span>
                      <div className="text-xs text-[var(--muted)]">
                        Поставка «{carton.shipmentTitle}»
                      </div>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {error && interacted ? (
          <p className="mt-3 text-sm text-[#c62828]">{error}</p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {existing ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm text-[#c62828] hover:bg-[#fdeceb]"
              >
                Убрать из перемещения
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm hover:bg-[var(--surface)]"
            >
              Отмена
            </button>
            <PrimaryButton type="button" disabled={Boolean(error)} onClick={submit}>
              {existing ? "Сохранить" : "Добавить"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function StockBalancesView() {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouseName, setWarehouseName] = useState<string | null>(null);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartonsProduct, setCartonsProduct] = useState<StockProduct | null>(null);
  const [transferProduct, setTransferProduct] = useState<StockProduct | null>(null);

  const [pendingWarehouseId, setPendingWarehouseId] = useState<string | null>(null);
  const [pendingWarehouseName, setPendingWarehouseName] = useState<string>("");
  const [pendingLines, setPendingLines] = useState<PendingTransferLine[]>([]);
  const [pendingRestored, setPendingRestored] = useState(false);
  const [navigatingToTransfer, startNavigateToTransfer] = useTransition();

  useEffect(() => {
    const draft = loadPendingTransfer();
    if (draft && draft.lines.length > 0) {
      setPendingWarehouseId(draft.warehouseId);
      setPendingWarehouseName(draft.warehouseName);
      setPendingLines(draft.lines);
    }
    setPendingRestored(true);
  }, []);

  useEffect(() => {
    // Skip until the restore effect above has run once, otherwise this would
    // see the still-empty initial state and immediately wipe out a draft
    // that's in the middle of being restored from sessionStorage.
    if (!pendingRestored) return;
    if (pendingLines.length === 0 || !pendingWarehouseId) {
      clearPendingTransfer();
      return;
    }
    savePendingTransfer({
      warehouseId: pendingWarehouseId,
      warehouseName: pendingWarehouseName,
      lines: pendingLines,
    });
  }, [pendingRestored, pendingLines, pendingWarehouseId, pendingWarehouseName]);

  useEffect(() => {
    if (!warehouseId) {
      setProducts([]);
      setError(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/stock?warehouseId=${encodeURIComponent(warehouseId!)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить остатки");
        if (!cancelled) setProducts(data.products || []);
      } catch (err) {
        if (!cancelled) {
          setProducts([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  const pendingByKey = useMemo(() => {
    const map = new Map<string, PendingTransferLine>();
    for (const line of pendingLines) map.set(line.key, line);
    return map;
  }, [pendingLines]);

  function handleWarehouseChange(id: string | null, warehouse?: { name: string } | null) {
    if (pendingLines.length > 0 && id !== pendingWarehouseId) {
      const ok = window.confirm(
        "Список товаров для перемещения собран для другого склада. При смене склада он будет очищен. Продолжить?",
      );
      if (!ok) return;
      setPendingLines([]);
      setPendingWarehouseId(null);
      setPendingWarehouseName("");
    }
    setWarehouseId(id);
    setWarehouseName(warehouse?.name ?? null);
  }

  function saveTransferLine(line: PendingTransferLine) {
    if (!warehouseId) return;
    setPendingLines((prev) => {
      const exists = prev.some((l) => l.key === line.key);
      if (exists) return prev.map((l) => (l.key === line.key ? line : l));
      return [...prev, line];
    });
    if (pendingLines.length === 0) {
      setPendingWarehouseId(warehouseId);
      setPendingWarehouseName(warehouseName || "");
    }
    setTransferProduct(null);
  }

  function removeTransferLine(key: string) {
    setPendingLines((prev) => prev.filter((l) => l.key !== key));
    setTransferProduct(null);
  }

  function clearPending() {
    if (!window.confirm("Очистить список товаров для перемещения?")) return;
    setPendingLines([]);
    setPendingWarehouseId(null);
    setPendingWarehouseName("");
  }

  function createTransfer() {
    if (!pendingWarehouseId || pendingLines.length === 0) return;
    savePendingTransfer({
      warehouseId: pendingWarehouseId,
      warehouseName: pendingWarehouseName,
      lines: pendingLines,
    });
    startNavigateToTransfer(() => {
      router.push("/transfers/new");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-md flex-1">
          <WarehouseSelect
            value={warehouseId}
            onChange={handleWarehouseChange}
            label="Склад"
            placeholder="Выберите склад"
          />
        </div>
        {warehouseId && products.length > 0 && !loading ? (
          <SecondaryButton
            type="button"
            onClick={() =>
              void import("@/lib/stock-export").then(({ exportStockToExcel }) =>
                exportStockToExcel(products, warehouseName || "sklad"),
              )
            }
          >
            Экспорт в Excel
          </SecondaryButton>
        ) : null}
      </div>

      {!warehouseId ? (
        <div className="px-6 py-16 text-center">
          <div className="text-base font-medium text-[var(--text)]">Выберите склад</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            После выбора склада здесь появится таблица остатков товаров.
          </p>
        </div>
      ) : loading ? (
        <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">
          Загрузка остатков…
        </div>
      ) : error ? (
        <p className="text-sm text-[#c62828]">{error}</p>
      ) : products.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="text-base font-medium text-[var(--text)]">Остатков нет</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            На этом складе нет товара в поставках и нет приходов по перемещениям.
          </p>
        </div>
      ) : (
        <div className="table-wrap pb-16">
          <table className="data">
            <thead>
              <tr>
                <th className="w-16">Фото</th>
                <th>Название</th>
                <th className="w-28">Остаток</th>
                <th className="w-28">Коробок</th>
                <th className="w-48">Перемещение</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const pending = pendingByKey.get(product.key) || null;
                return (
                  <tr key={product.key}>
                    <td>
                      {product.photoUrl ? (
                        <ProductPhotoPreview
                          src={product.photoUrl}
                          alt={product.productName}
                        />
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td>
                      <ProductNameCell product={product} />
                    </td>
                    <td className="col-center">{formatNumber(product.availableTotal)}</td>
                    <td className="col-center">
                      <button
                        type="button"
                        onClick={() => setCartonsProduct(product)}
                        className="font-medium text-[var(--link)] hover:underline"
                        title="Показать коробки"
                      >
                        {formatNumber(product.cartonCount)}
                      </button>
                    </td>
                    <td>
                      {pending ? (
                        <button
                          type="button"
                          onClick={() => setTransferProduct(product)}
                          className="rounded-lg border border-[var(--brand)] bg-[var(--surface)] px-3 py-1.5 text-left text-xs font-medium hover:brightness-95"
                        >
                          В перемещении: {formatNumber(pending.qty)} шт ·{" "}
                          {pending.cartons.length} кор.
                        </button>
                      ) : (
                        <SecondaryButton
                          type="button"
                          className="!px-3 !py-1.5 text-xs"
                          onClick={() => setTransferProduct(product)}
                        >
                          Добавить к перемещению
                        </SecondaryButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cartonsProduct ? (
        <CartonsModal
          product={cartonsProduct}
          onClose={() => setCartonsProduct(null)}
        />
      ) : null}

      {transferProduct ? (
        <AddToTransferModal
          product={transferProduct}
          existing={pendingByKey.get(transferProduct.key) || null}
          onClose={() => setTransferProduct(null)}
          onSave={saveTransferLine}
          onRemove={() => removeTransferLine(transferProduct.key)}
        />
      ) : null}

      {pendingLines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium">
                Выбрано товаров: {pendingLines.length}
              </span>
              <span className="text-[var(--muted)]">
                {" "}
                · склад «{pendingWarehouseName}»
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearPending}
                disabled={navigatingToTransfer}
                className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm hover:bg-[var(--surface)] disabled:opacity-60"
              >
                Очистить
              </button>
              <PrimaryButton
                type="button"
                onClick={createTransfer}
                disabled={navigatingToTransfer}
              >
                {navigatingToTransfer
                  ? "Открываем перемещение…"
                  : "Создать перемещение выбранных товаров"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
