import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { PackingItemNameCell } from "@/components/PackingItemNameCell";
import { ProductPhotoPreview } from "@/components/ProductPhotoPreview";
import {
  findProductPhoto,
  listProductPhotos,
  productPhotoUrl,
} from "@/lib/product-photos";
import { remainingPcsForItem } from "@/lib/stock";
import { loadUsedQtyForShipment } from "@/lib/stock-query";

type Item = {
  id: string;
  lineNo: number;
  cartonLabel: string;
  cartonFrom: number | null;
  cartonTo: number | null;
  mark: string;
  supplierName: string;
  mappedName: string;
  mappedCode: string;
  mappedArticle: string;
  pcsPerCarton: number | null;
  totalPcs: number | null;
  totalCartons: number | null;
  grossWeightPerCarton: number | null;
  totalGrossWeight: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  volumeCbm: number | null;
  totalCbm: number | null;
};

function sizeLabel(item: Pick<Item, "lengthCm" | "widthCm" | "heightCm">) {
  if (item.lengthCm == null && item.widthCm == null && item.heightCm == null) {
    return "—";
  }
  return [item.lengthCm, item.widthCm, item.heightCm]
    .map((n) => (n == null ? "—" : formatNumber(n, n % 1 === 0 ? 0 : 1)))
    .join(" × ");
}

function firstPresent<K extends keyof Item>(group: Item[], key: K): Item[K] {
  for (const item of group) {
    if (item[key] != null) return item[key];
  }
  return group[0]![key];
}

function boxMetrics(group: Item[]) {
  const hasPcs = group.some((item) => item.totalPcs != null);
  return {
    totalPcs: hasPcs ? group.reduce((sum, item) => sum + (item.totalPcs ?? 0), 0) : null,
    totalCartons: firstPresent(group, "totalCartons"),
    grossWeightPerCarton: firstPresent(group, "grossWeightPerCarton"),
    totalGrossWeight: firstPresent(group, "totalGrossWeight"),
    lengthCm: firstPresent(group, "lengthCm"),
    widthCm: firstPresent(group, "widthCm"),
    heightCm: firstPresent(group, "heightCm"),
    volumeCbm: firstPresent(group, "volumeCbm"),
    totalCbm: firstPresent(group, "totalCbm"),
  };
}

function cartonRange(item: Item) {
  if (item.cartonFrom != null && item.cartonTo != null && item.cartonFrom !== item.cartonTo) {
    return `${item.cartonFrom}–${item.cartonTo}`;
  }
  if (item.cartonFrom != null) return String(item.cartonFrom);
  return item.cartonLabel || "—";
}

function sameCarton(a: Item, b: Item) {
  if (a.cartonFrom != null && b.cartonFrom != null) {
    return a.cartonFrom === b.cartonFrom && a.cartonTo === b.cartonTo;
  }
  return Boolean(a.cartonLabel) && a.cartonLabel === b.cartonLabel;
}

function cartonGroupSize(items: Item[], start: number) {
  let size = 1;
  while (start + size < items.length && sameCarton(items[start]!, items[start + size]!)) {
    size += 1;
  }
  return size;
}

function productsInBoxLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} товар в коробке`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара в коробке`;
  }
  return `${count} товаров в коробке`;
}

function ProductPhoto({
  files,
  item,
}: {
  files: string[];
  item: Item;
}) {
  if (!item.mappedName) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  const file = findProductPhoto(files, item.mappedCode, item.mappedArticle);
  if (!file) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  return <ProductPhotoPreview src={productPhotoUrl(file)} alt={item.mappedName} />;
}

export async function PackingItemsTable({
  items,
  shipmentId,
}: {
  items: Item[];
  shipmentId: string;
}) {
  const [photoFiles, usedByKey] = await Promise.all([
    listProductPhotos(),
    loadUsedQtyForShipment(shipmentId),
  ]);
  if (items.length === 0) {
    return (
      <EmptyState
        title="Товаров пока нет"
        description="Загрузите packing list, чтобы увидеть позиции, коробки, вес и объём."
      />
    );
  }

  const remainingById = new Map<string, number | null>();
  for (const item of items) {
    remainingById.set(item.id, remainingPcsForItem(item, usedByKey));
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.pcs += item.totalPcs ?? 0;
      acc.remaining += remainingById.get(item.id) ?? 0;
      acc.cartons += item.totalCartons ?? 0;
      acc.kg += item.totalGrossWeight ?? 0;
      acc.cbm += item.totalCbm ?? 0;
      acc.mapped += item.mappedName ? 1 : 0;
      return acc;
    },
    { pcs: 0, remaining: 0, cartons: 0, kg: 0, cbm: 0, mapped: 0 },
  );

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Коробки</th>
            <th>Фото товара</th>
            <th>
              Название
              <div className="mt-0.5 text-[11px] font-normal text-[var(--muted)]">
                Сопоставлено {formatNumber(totals.mapped)} из {formatNumber(items.length)}
              </div>
            </th>
            <th className="col-pcs">Шт / кор.</th>
            <th>Всего шт</th>
            <th>Остаток шт</th>
            <th>Коробок</th>
            <th>Вес / кор., кг</th>
            <th>Всего кг</th>
            <th>Габариты, см</th>
            <th>м³</th>
            <th>Всего м³</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const prev = items[index - 1];
            const isGroupStart = !prev || !sameCarton(prev, item);
            const groupSize = isGroupStart ? cartonGroupSize(items, index) : 0;
            const group = isGroupStart ? items.slice(index, index + groupSize) : [];
            const box = isGroupStart ? boxMetrics(group) : null;
            const inSharedBox = groupSize > 1 || Boolean(prev && sameCarton(prev, item));
            const remaining = remainingById.get(item.id);

            return (
              <tr key={item.id} className={inSharedBox ? "row-shared-box" : undefined}>
                {isGroupStart ? (
                  <td rowSpan={groupSize} className="cell-box">
                    <div className="font-medium">{cartonRange(item)}</div>
                    {item.cartonLabel && item.cartonFrom != null ? (
                      <div className="mt-0.5 text-xs text-[var(--muted)]">{item.cartonLabel}</div>
                    ) : null}
                    {groupSize > 1 ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {productsInBoxLabel(groupSize)}
                      </div>
                    ) : null}
                  </td>
                ) : null}
                <td>
                  <ProductPhoto files={photoFiles} item={item} />
                </td>
                <td>
                  <PackingItemNameCell
                    shipmentId={shipmentId}
                    itemId={item.id}
                    supplierName={item.supplierName}
                    mappedName={item.mappedName}
                    mappedCode={item.mappedCode}
                    mappedArticle={item.mappedArticle}
                  />
                </td>
                <td className="col-pcs">{formatNumber(item.pcsPerCarton)}</td>
                <td className="col-center">{formatNumber(item.totalPcs)}</td>
                <td className="col-center">
                  {remaining == null ? "—" : formatNumber(remaining)}
                </td>
                {isGroupStart && box ? (
                  <>
                    <td rowSpan={groupSize} className="cell-box col-center col-cartons">
                      {formatNumber(box.totalCartons)}
                    </td>
                    <td rowSpan={groupSize} className="cell-box col-center">
                      {formatNumber(box.grossWeightPerCarton, 1)}
                    </td>
                    <td rowSpan={groupSize} className="cell-box col-center">
                      {formatNumber(box.totalGrossWeight, 1)}
                    </td>
                    <td rowSpan={groupSize} className="cell-box col-center">
                      {sizeLabel(box)}
                    </td>
                    <td rowSpan={groupSize} className="cell-box col-center">
                      {formatNumber(box.volumeCbm, 3)}
                    </td>
                    <td rowSpan={groupSize} className="cell-box col-center cell-last">
                      {formatNumber(box.totalCbm, 3)}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Итого</td>
            <td className="col-center">{formatNumber(totals.pcs)}</td>
            <td className="col-center">{formatNumber(totals.remaining)}</td>
            <td className="col-center col-cartons">{formatNumber(totals.cartons)}</td>
            <td></td>
            <td className="col-center">{formatNumber(totals.kg, 1)}</td>
            <td></td>
            <td></td>
            <td className="col-center">{formatNumber(totals.cbm, 3)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
