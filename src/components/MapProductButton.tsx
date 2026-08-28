"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingOverlay } from "@/components/LoadingOverlay";

type Product = {
  id: string;
  code: string;
  article: string;
  name: string;
};

export function MapProductButton({
  shipmentId,
  itemId,
  supplierName,
  mappedName,
}: {
  shipmentId: string;
  itemId: string;
  supplierName: string;
  mappedName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    void search("");
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function search(value: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(value)}&limit=40`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить товары");
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function onQuery(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(value), 220);
  }

  async function choose(product: Product) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/items/${itemId}/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сопоставить");
      setRefreshLabel("Применяем сопоставление...");
      startTransition(() => {
        setOpen(false);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {isPending ? <LoadingOverlay label={refreshLabel || "Обновляем данные..."} /> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={saving || isPending}
        className="mt-1 rounded-md border border-[var(--border)] px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface)] disabled:opacity-60"
      >
        {mappedName ? "Изменить" : "Сопоставить"}
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 pt-[8vh]"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/45"
                onClick={() => {
                  if (!saving && !isPending) setOpen(false);
                }}
              />
              <div className="relative w-full max-w-xl rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
                {saving || isPending ? (
                  <LoadingOverlay
                    compact
                    label={saving ? "Сохраняем сопоставление..." : "Обновляем таблицу..."}
                  />
                ) : null}
                <div className="text-sm font-semibold">Сопоставить товар</div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Китайское название:{" "}
                  <span className="font-medium text-[var(--text)]">{supplierName}</span>
                </p>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  className="field mt-3"
                  placeholder="Название, код или артикул"
                />
                {error ? <p className="mt-2 text-sm text-[#c62828]">{error}</p> : null}
                {total === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    Справочник пуст. Загрузите Excel на странице{" "}
                    <Link href="/settings" className="text-[var(--link)] hover:underline">
                      Настройки
                    </Link>
                    .
                  </p>
                ) : loading ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">Поиск…</p>
                ) : products.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">Ничего не найдено</p>
                ) : (
                  <div className="mt-3 max-h-[360px] overflow-y-auto rounded-lg border border-[var(--border)]">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Код</th>
                          <th>Артикул</th>
                          <th>Название</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product) => (
                          <tr
                            key={product.id}
                            className={`cursor-pointer ${saving ? "opacity-60" : ""}`}
                            onClick={() => {
                              if (!saving) void choose(product);
                            }}
                          >
                            <td className="whitespace-nowrap font-medium">{product.code}</td>
                            <td className="whitespace-nowrap">{product.article || "—"}</td>
                            <td>{product.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={saving || isPending}
                    className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
