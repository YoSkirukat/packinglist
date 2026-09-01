"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WarehouseSelect } from "@/components/WarehouseSelect";
import { ProductPhotoPreview } from "@/components/ProductPhotoPreview";
import { SecondaryButton } from "@/components/ui-client";
import { formatNumber } from "@/lib/format";

type StockCarton = {
  cartonNo: number;
  available: number;
  shipmentTitle: string;
};

type StockProduct = {
  key: string;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName: string;
  availableTotal: number;
  cartonCount: number;
  photoUrl: string | null;
  cartons: StockCarton[];
};

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
              key={`${carton.cartonNo}-${carton.shipmentTitle}`}
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

export function StockBalancesView() {
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouseName, setWarehouseName] = useState<string | null>(null);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartonsProduct, setCartonsProduct] = useState<StockProduct | null>(null);

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-md flex-1">
          <WarehouseSelect
            value={warehouseId}
            onChange={(id, warehouse) => {
              setWarehouseId(id);
              setWarehouseName(warehouse?.name ?? null);
            }}
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
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="w-16">Фото</th>
                <th>Название</th>
                <th className="w-28">Остаток</th>
                <th className="w-28">Коробок</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
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
                </tr>
              ))}
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
    </div>
  );
}
