import { prisma } from "@/lib/prisma";
import {
  allocationKey,
  buildCartonSlots,
  matchesStockQuery,
  productGroupKey,
  type CartonSlot,
  type PackingItemStockSource,
} from "@/lib/stock";

export async function loadUsedQtyByCarton(excludeTransferId?: string | null) {
  const allocations = await prisma.stockTransferAllocation.findMany({
    where: excludeTransferId
      ? { line: { transferId: { not: excludeTransferId } } }
      : undefined,
    select: {
      packingItemId: true,
      cartonNo: true,
      qty: true,
    },
  });

  const usedByKey: Record<string, number> = {};
  for (const row of allocations) {
    const key = allocationKey(row.packingItemId, row.cartonNo);
    usedByKey[key] = (usedByKey[key] ?? 0) + row.qty;
  }
  return usedByKey;
}

export async function loadUsedQtyForShipment(
  shipmentId: string,
  excludeTransferId?: string | null,
) {
  const allocations = await prisma.stockTransferAllocation.findMany({
    where: {
      shipmentId,
      ...(excludeTransferId
        ? { line: { transferId: { not: excludeTransferId } } }
        : {}),
    },
    select: {
      packingItemId: true,
      cartonNo: true,
      qty: true,
    },
  });

  const usedByKey: Record<string, number> = {};
  for (const row of allocations) {
    const key = allocationKey(row.packingItemId, row.cartonNo);
    usedByKey[key] = (usedByKey[key] ?? 0) + row.qty;
  }
  return usedByKey;
}

export async function getWarehouseCartonSlots(input: {
  warehouseId: string;
  excludeTransferId?: string | null;
}): Promise<CartonSlot[]> {
  const shipments = await prisma.shipment.findMany({
    where: { warehouseId: input.warehouseId },
    select: {
      id: true,
      title: true,
      items: {
        select: {
          id: true,
          shipmentId: true,
          cartonLabel: true,
          cartonFrom: true,
          cartonTo: true,
          pcsPerCarton: true,
          totalPcs: true,
          productId: true,
          mappedName: true,
          mappedCode: true,
          mappedArticle: true,
          supplierName: true,
        },
      },
    },
  });

  const items: PackingItemStockSource[] = [];
  const shipmentTitles: Record<string, string> = {};
  for (const shipment of shipments) {
    shipmentTitles[shipment.id] = shipment.title;
    for (const item of shipment.items) {
      items.push(item);
    }
  }

  const usedByKey = await loadUsedQtyByCarton(input.excludeTransferId);
  return buildCartonSlots({ items, shipmentTitles, usedByKey });
}

export type StockProductHit = {
  key: string;
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName: string;
  availableTotal: number;
  cartons: {
    packingItemId: string;
    shipmentId: string;
    shipmentTitle: string;
    cartonNo: number;
    available: number;
  }[];
};

export function groupSlotsToProducts(
  slots: CartonSlot[],
  query: string,
  limit?: number,
): StockProductHit[] {
  const filtered = slots.filter((s) => matchesStockQuery(s, query));
  const groups = new Map<string, StockProductHit>();

  for (const slot of filtered) {
    const key = productGroupKey(slot);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        productId: slot.productId,
        productName: slot.productName,
        productCode: slot.productCode,
        productArticle: slot.productArticle,
        supplierName: slot.supplierName,
        availableTotal: 0,
        cartons: [],
      };
      groups.set(key, group);
    }
    group.availableTotal += slot.available;
    group.cartons.push({
      packingItemId: slot.packingItemId,
      shipmentId: slot.shipmentId,
      shipmentTitle: slot.shipmentTitle,
      cartonNo: slot.cartonNo,
      available: slot.available,
    });
  }

  const result = [...groups.values()]
    .map((g) => {
      // merge duplicate carton keys within a product (e.g. inbound + edge cases)
      const cartonMap = new Map<
        string,
        StockProductHit["cartons"][number]
      >();
      for (const c of g.cartons) {
        const ck = allocationKey(c.packingItemId, c.cartonNo);
        const prev = cartonMap.get(ck);
        if (prev) {
          prev.available = Math.round((prev.available + c.available) * 1000) / 1000;
        } else {
          cartonMap.set(ck, { ...c });
        }
      }
      const cartons = [...cartonMap.values()].sort((a, b) => {
        if (a.cartonNo !== b.cartonNo) return a.cartonNo - b.cartonNo;
        return a.shipmentTitle.localeCompare(b.shipmentTitle, "ru");
      });
      return {
        ...g,
        availableTotal: Math.round(
          cartons.reduce((sum, c) => sum + c.available, 0) * 1000,
        ) / 1000,
        cartons,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "ru"));

  if (limit != null && Number.isFinite(limit)) {
    return result.slice(0, limit);
  }
  return result;
}

export async function getInboundWarehouseCartonSlots(
  warehouseId: string,
): Promise<CartonSlot[]> {
  const transfers = await prisma.stockTransfer.findMany({
    where: { toWarehouseId: warehouseId },
    select: {
      lines: {
        select: {
          productId: true,
          productName: true,
          productCode: true,
          productArticle: true,
          allocations: {
            select: {
              packingItemId: true,
              shipmentId: true,
              cartonNo: true,
              qty: true,
            },
          },
        },
      },
    },
  });

  const shipmentIds = new Set<string>();
  for (const t of transfers) {
    for (const line of t.lines) {
      for (const a of line.allocations) {
        shipmentIds.add(a.shipmentId);
      }
    }
  }

  const shipments = shipmentIds.size
    ? await prisma.shipment.findMany({
        where: { id: { in: [...shipmentIds] } },
        select: { id: true, title: true },
      })
    : [];
  const shipmentTitles = Object.fromEntries(shipments.map((s) => [s.id, s.title]));

  // Also try supplierName from packing items for display
  const packingItemIds = new Set<string>();
  for (const t of transfers) {
    for (const line of t.lines) {
      for (const a of line.allocations) {
        packingItemIds.add(a.packingItemId);
      }
    }
  }
  const packingItems = packingItemIds.size
    ? await prisma.packingItem.findMany({
        where: { id: { in: [...packingItemIds] } },
        select: { id: true, supplierName: true },
      })
    : [];
  const supplierByItem = Object.fromEntries(
    packingItems.map((i) => [i.id, i.supplierName]),
  );

  const merged = new Map<string, CartonSlot>();

  for (const t of transfers) {
    for (const line of t.lines) {
      for (const a of line.allocations) {
        if (a.qty <= 0) continue;
        const key = allocationKey(a.packingItemId, a.cartonNo);
        const existing = merged.get(key);
        if (existing) {
          existing.available =
            Math.round((existing.available + a.qty) * 1000) / 1000;
          existing.initialQty = existing.available;
          continue;
        }
        merged.set(key, {
          packingItemId: a.packingItemId,
          shipmentId: a.shipmentId,
          shipmentTitle: shipmentTitles[a.shipmentId] || "Поставка",
          cartonNo: a.cartonNo,
          initialQty: a.qty,
          available: a.qty,
          productId: line.productId,
          productName: line.productName,
          productCode: line.productCode,
          productArticle: line.productArticle,
          supplierName: supplierByItem[a.packingItemId] || "",
        });
      }
    }
  }

  return [...merged.values()];
}

export async function getWarehouseStock(warehouseId: string): Promise<
  (StockProductHit & { cartonCount: number })[]
> {
  const [localSlots, inboundSlots] = await Promise.all([
    getWarehouseCartonSlots({ warehouseId }),
    getInboundWarehouseCartonSlots(warehouseId),
  ]);

  const products = groupSlotsToProducts(
    [...localSlots, ...inboundSlots],
    "",
  );

  return products.map((p) => ({
    ...p,
    cartonCount: p.cartons.filter((c) => c.available > 0).length,
  }));
}
