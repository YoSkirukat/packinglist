"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WarehouseSelect } from "@/components/WarehouseSelect";
import { ProductPhotoPreview } from "@/components/ProductPhotoPreview";
import { CartonSelect } from "@/components/CartonSelect";
import { formatNumber } from "@/lib/format";
import { exportTransferLinesToExcel } from "@/lib/transfer-line-export";

type CartonOption = {
  packingItemId: string;
  shipmentId: string;
  shipmentTitle: string;
  cartonNo: number;
  available: number;
};

type StockProduct = {
  key: string;
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName: string;
  availableTotal: number;
  photoUrl: string | null;
  cartons: CartonOption[];
};

type LineDraft = {
  localId: string;
  key: string;
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  photoUrl: string | null;
  qty: number;
  cartons: CartonOption[];
  selectedKeys: string[];
};

type InitialTransfer = {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  note: string;
  lines: {
    productId: string | null;
    productName: string;
    productCode: string;
    productArticle: string;
    qty: number;
    allocations: {
      packingItemId: string;
      shipmentId: string;
      cartonNo: number;
      qty: number;
    }[];
  }[];
};

function cartonOptionKey(c: Pick<CartonOption, "packingItemId" | "cartonNo">) {
  return `${c.packingItemId}:${c.cartonNo}`;
}

function selectedCapacity(line: LineDraft) {
  return line.cartons
    .filter((c) => line.selectedKeys.includes(cartonOptionKey(c)))
    .reduce((sum, c) => sum + c.available, 0);
}

function selectedCartonLabel(line: LineDraft) {
  return line.cartons
    .filter((c) => line.selectedKeys.includes(cartonOptionKey(c)))
    .map((c) => c.cartonNo)
    .sort((a, b) => a - b)
    .join(", ");
}

export function TransferForm({
  mode,
  transferId,
  initial,
}: {
  mode: "create" | "edit";
  transferId?: string;
  initial?: InitialTransfer;
}) {
  const router = useRouter();
  const [fromWarehouseId, setFromWarehouseId] = useState<string | null>(
    initial?.fromWarehouseId ?? null,
  );
  const [toWarehouseId, setToWarehouseId] = useState<string | null>(
    initial?.toWarehouseId ?? null,
  );
  const [fromWarehouseName, setFromWarehouseName] = useState<string | null>(null);
  const [toWarehouseName, setToWarehouseName] = useState<string | null>(null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StockProduct[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(transferId ?? null);
  const [bootstrapping, setBootstrapping] = useState(mode === "edit");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLInputElement>(null);
  const isEditing = savedId !== null;

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !initial || !fromWarehouseId) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    async function hydrate() {
      setBootstrapping(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/transfers/stock?warehouseId=${encodeURIComponent(fromWarehouseId!)}&q=&limit=80&excludeTransferId=${encodeURIComponent(initial!.id)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить остатки");
        const products = (data.products || []) as StockProduct[];

        const nextLines: LineDraft[] = initial!.lines.map((line, index) => {
          const match =
            products.find(
              (p) =>
                (line.productId && p.productId === line.productId) ||
                (p.productName === line.productName &&
                  p.productCode === line.productCode &&
                  p.productArticle === line.productArticle),
            ) || null;

          const cartons = match?.cartons ?? [];
          const selectedKeys = line.allocations.map((a) =>
            cartonOptionKey({ packingItemId: a.packingItemId, cartonNo: a.cartonNo }),
          );

          // Ensure selected cartons exist even if match incomplete
          const cartonMap = new Map(cartons.map((c) => [cartonOptionKey(c), c]));
          for (const a of line.allocations) {
            const key = cartonOptionKey(a);
            if (!cartonMap.has(key)) {
              cartonMap.set(key, {
                packingItemId: a.packingItemId,
                shipmentId: a.shipmentId,
                shipmentTitle: "Поставка",
                cartonNo: a.cartonNo,
                available: a.qty,
              });
            }
          }

          return {
            localId: `init-${index}`,
            key: match?.key || `line-${index}`,
            productId: line.productId,
            productName: line.productName,
            productCode: line.productCode,
            productArticle: line.productArticle,
            photoUrl: match?.photoUrl ?? null,
            qty: line.qty,
            cartons: [...cartonMap.values()],
            selectedKeys,
          };
        });

        if (!cancelled) setLines(nextLines);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, transferId]);

  async function search(value: string, warehouseId: string) {
    setSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        warehouseId,
        q: value,
        limit: "40",
      });
      if (transferId) params.set("excludeTransferId", transferId);
      const res = await fetch(`/api/transfers/stock?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ошибка поиска");
      setHits(data.products || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  function onQuery(value: string) {
    setQuery(value);
    if (!fromWarehouseId) {
      setHits([]);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(value, fromWarehouseId), 220);
  }

  function onSearchFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setSearchOpen(true);
    if (fromWarehouseId) void search(query, fromWarehouseId);
  }

  function onSearchBlur() {
    blurTimer.current = setTimeout(() => setSearchOpen(false), 150);
  }

  useEffect(() => {
    if (!fromWarehouseId) {
      setHits([]);
      setSearchOpen(false);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWarehouseId]);

  function addProduct(product: StockProduct) {
    const existing = lines.find((l) => l.key === product.key);
    setQuery("");
    setHits([]);
    setSearchOpen(false);

    if (existing) {
      const row = document.getElementById(`transfer-line-${existing.localId}`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.remove("row-attention");
        void row.offsetWidth;
        row.classList.add("row-attention");
        window.setTimeout(() => row.classList.remove("row-attention"), 2100);
      }
      return;
    }

    setLines((prev) => [
      {
        localId: `${product.key}-${Date.now()}`,
        key: product.key,
        productId: product.productId,
        productName: product.productName,
        productCode: product.productCode,
        productArticle: product.productArticle,
        photoUrl: product.photoUrl,
        qty: 1,
        cartons: product.cartons,
        selectedKeys: [],
      },
      ...prev,
    ]);
  }

  function updateLine(localId: string, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.localId === localId ? { ...line, ...patch } : line)),
    );
  }

  function toggleCarton(localId: string, carton: CartonOption) {
    const key = cartonOptionKey(carton);
    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;
        const selected = line.selectedKeys.includes(key)
          ? line.selectedKeys.filter((k) => k !== key)
          : [...line.selectedKeys, key];
        return { ...line, selectedKeys: selected };
      }),
    );
  }

  function removeLine(localId: string) {
    setLines((prev) => prev.filter((l) => l.localId !== localId));
  }

  async function exportExcel() {
    setExporting(true);
    setError(null);
    try {
      await exportTransferLinesToExcel(
        lines.map((line) => ({
          photoUrl: line.photoUrl,
          productName: line.productName,
          productCode: line.productCode,
          productArticle: line.productArticle,
          qty: line.qty,
          cartonLabel: selectedCartonLabel(line),
        })),
        fromWarehouseName || "sklad",
        toWarehouseName || "sklad",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  const lineErrors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const line of lines) {
      const cap = selectedCapacity(line);
      if (line.selectedKeys.length === 0) {
        map[line.localId] = "Выберите коробки";
      } else if (cap + 1e-9 < line.qty) {
        map[line.localId] = `Недостаточно в выбранных коробках (доступно ${formatNumber(cap)})`;
      }
    }
    return map;
  }, [lines]);

  const lineTotals = useMemo(
    () => ({
      productCount: lines.length,
      unitCount: lines.reduce(
        (sum, line) => sum + (Number.isFinite(line.qty) ? line.qty : 0),
        0,
      ),
    }),
    [lines],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!fromWarehouseId || !toWarehouseId) {
      setError("Укажите склад-источник и склад-получатель");
      return;
    }
    if (Object.keys(lineErrors).length > 0) {
      setError("Исправьте ошибки в строках перемещения");
      return;
    }
    if (lines.length === 0) {
      setError("Добавьте хотя бы один товар");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fromWarehouseId,
        toWarehouseId,
        note,
        lines: lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          productCode: line.productCode,
          productArticle: line.productArticle,
          qty: line.qty,
          cartons: line.cartons
            .filter((c) => line.selectedKeys.includes(cartonOptionKey(c)))
            .map((c) => ({
              packingItemId: c.packingItemId,
              shipmentId: c.shipmentId,
              cartonNo: c.cartonNo,
            })),
        })),
      };

      const res = await fetch(
        savedId ? `/api/transfers/${savedId}` : "/api/transfers",
        {
          method: savedId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить перемещение");

      if (!savedId && data.transfer?.id) {
        setSavedId(data.transfer.id);
        window.history.replaceState(null, "", `/transfers/${data.transfer.id}/edit`);
      }

      setMessage("Сохранено");
      if (messageTimer.current) clearTimeout(messageTimer.current);
      messageTimer.current = setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <WarehouseSelect
          value={fromWarehouseId}
          onChange={(id, wh) => {
            setFromWarehouseId(id);
            setFromWarehouseName(wh?.name ?? null);
            setLines([]);
            setHits([]);
          }}
          label="Склад-источник"
          placeholder="Выберите склад"
          allowEmpty
          disabled={saving || bootstrapping}
        />
        <div>
          <WarehouseSelect
            value={toWarehouseId}
            onChange={(id, wh) => {
              setToWarehouseId(id);
              setToWarehouseName(wh?.name ?? null);
            }}
            label="Склад-получатель"
            placeholder="Выберите склад"
            allowEmpty
            disabled={saving || bootstrapping}
          />
          <p className="mt-2 text-sm text-[var(--muted)]">
            Товаров: {formatNumber(lineTotals.productCount)} · Единиц из поставки:{" "}
            {formatNumber(lineTotals.unitCount, lineTotals.unitCount % 1 === 0 ? 0 : 3)}
          </p>
        </div>
      </div>

      <label className="block max-w-xl">
        <span className="mb-1.5 block text-sm font-medium">Комментарий</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="field"
          placeholder="Необязательно"
          disabled={saving}
        />
      </label>

      <div>
        <div className="mb-1.5 text-sm font-medium">Добавить товар</div>
        <div className="relative z-30 max-w-xl">
          <input
            ref={searchBoxRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            className="field"
            placeholder={
              fromWarehouseId
                ? "Поиск по названию, коду, артикулу…"
                : "Сначала выберите склад-источник"
            }
            disabled={!fromWarehouseId || saving || bootstrapping}
          />
          {searching && searchOpen ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
              …
            </div>
          ) : null}
          {searchOpen && hits.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-white shadow-lg">
              {hits.map((product) => (
                <button
                  key={product.key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addProduct(product)}
                  className="flex w-full items-start gap-3 border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--surface)]"
                >
                  {product.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.photoUrl}
                      alt=""
                      className="h-10 w-10 rounded border border-[var(--border)] object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--border)] text-xs text-[var(--muted)]">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{product.productName}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {[product.productCode, product.productArticle]
                        .filter(Boolean)
                        .join(" · ") || product.supplierName}
                      {" · остаток "}
                      {formatNumber(product.availableTotal)} шт
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {searchError ? <p className="mt-1 text-sm text-[#c62828]">{searchError}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Товары в перемещении</div>
        <button
          type="button"
          disabled={exporting || lines.length === 0}
          onClick={() => void exportExcel()}
          className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--surface)] disabled:opacity-60"
        >
          {exporting ? "Экспорт…" : "Экспорт в Excel"}
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="w-16">Фото</th>
              <th>Название</th>
              <th className="w-28">Кол-во</th>
              <th className="min-w-[200px]">Коробка</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-[var(--muted)]">
                  {bootstrapping
                    ? "Загрузка строк…"
                    : "Добавьте товары через поиск выше"}
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const err = lineErrors[line.localId];
                return (
                  <tr key={line.localId} id={`transfer-line-${line.localId}`}>
                    <td>
                      {line.photoUrl ? (
                        <ProductPhotoPreview src={line.photoUrl} alt={line.productName} />
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td>
                      <div className="font-medium">{line.productName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {[line.productCode, line.productArticle].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                      {err ? <div className="mt-1 text-xs text-[#c62828]">{err}</div> : null}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.localId, {
                            qty: Number(e.target.value) || 0,
                          })
                        }
                        className="field py-1.5"
                        disabled={saving}
                      />
                    </td>
                    <td>
                      <CartonSelect
                        cartons={line.cartons}
                        selectedKeys={line.selectedKeys}
                        onToggle={(carton) => toggleCarton(line.localId, carton)}
                        disabled={saving}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        title="Убрать"
                        aria-label={`Убрать ${line.productName}`}
                        onClick={() => removeLine(line.localId)}
                        disabled={saving}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[#c62828] hover:bg-[#fdeceb] disabled:opacity-60"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-[var(--border)] bg-white/95 px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || bootstrapping}
            className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Сохранение…" : isEditing ? "Сохранить изменения" : "Создать перемещение"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => router.push("/transfers")}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-[var(--surface)]"
          >
            Отмена
          </button>
          {message ? <span className="text-sm font-medium text-[#1a7f37]">{message}</span> : null}
          {error ? <span className="text-sm text-[#c62828]">{error}</span> : null}
        </div>
      </div>
    </form>
  );
}
