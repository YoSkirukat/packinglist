export type PackingItemCartonSource = {
  id: string;
  cartonLabel: string;
  cartonFrom: number | null;
  cartonTo: number | null;
  pcsPerCarton: number | null;
  totalPcs: number | null;
};

export type PackingItemStockSource = PackingItemCartonSource & {
  shipmentId: string;
  productId: string | null;
  mappedName: string;
  mappedCode: string;
  mappedArticle: string;
  supplierName: string;
};

export type CartonSlot = {
  packingItemId: string;
  shipmentId: string;
  shipmentTitle: string;
  cartonNo: number;
  initialQty: number;
  available: number;
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName: string;
};

export type CartonAllocationKey = {
  packingItemId: string;
  cartonNo: number;
};

export type SelectedCarton = {
  packingItemId: string;
  shipmentId: string;
  cartonNo: number;
  available: number;
};

export type LineAllocationInput = {
  packingItemId: string;
  shipmentId: string;
  cartonNo: number;
};

export type TransferLineInput = {
  productId?: string | null;
  productName: string;
  productCode?: string;
  productArticle?: string;
  qty: number;
  cartons: LineAllocationInput[];
};

function roundQty(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function expandItemCartons(item: PackingItemCartonSource): number[] {
  if (item.cartonFrom != null && item.cartonTo != null) {
    const from = Math.min(item.cartonFrom, item.cartonTo);
    const to = Math.max(item.cartonFrom, item.cartonTo);
    const nos: number[] = [];
    for (let n = from; n <= to; n += 1) nos.push(n);
    return nos;
  }
  const nums = [...item.cartonLabel.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  if (nums.length === 0) return [];
  if (nums.length === 1) return [nums[0]!];
  const from = Math.min(...nums);
  const to = Math.max(...nums);
  const nos: number[] = [];
  for (let n = from; n <= to; n += 1) nos.push(n);
  return nos;
}

export function initialQtyPerCarton(item: PackingItemCartonSource): number {
  const cartons = expandItemCartons(item);
  if (cartons.length === 0) return 0;
  if (item.pcsPerCarton != null && item.pcsPerCarton > 0) {
    return item.pcsPerCarton;
  }
  if (item.totalPcs != null && item.totalPcs > 0) {
    return roundQty(item.totalPcs / cartons.length);
  }
  return 0;
}

export function allocationKey(packingItemId: string, cartonNo: number) {
  return `${packingItemId}:${cartonNo}`;
}

export function buildCartonSlots(input: {
  items: PackingItemStockSource[];
  shipmentTitles: Record<string, string>;
  usedByKey: Record<string, number>;
}): CartonSlot[] {
  const slots: CartonSlot[] = [];

  for (const item of input.items) {
    const cartonNos = expandItemCartons(item);
    if (cartonNos.length === 0) continue;
    const initial = initialQtyPerCarton(item);
    if (initial <= 0) continue;

    const productName =
      item.mappedName.trim() || item.supplierName.trim() || "Без названия";

    for (const cartonNo of cartonNos) {
      const key = allocationKey(item.id, cartonNo);
      const used = input.usedByKey[key] ?? 0;
      const available = roundQty(Math.max(0, initial - used));
      if (available <= 0) continue;

      slots.push({
        packingItemId: item.id,
        shipmentId: item.shipmentId,
        shipmentTitle: input.shipmentTitles[item.shipmentId] || "Поставка",
        cartonNo,
        initialQty: initial,
        available,
        productId: item.productId,
        productName,
        productCode: item.mappedCode || "",
        productArticle: item.mappedArticle || "",
        supplierName: item.supplierName,
      });
    }
  }

  return slots.sort((a, b) => {
    const nameCmp = a.productName.localeCompare(b.productName, "ru");
    if (nameCmp !== 0) return nameCmp;
    if (a.cartonNo !== b.cartonNo) return a.cartonNo - b.cartonNo;
    return a.shipmentTitle.localeCompare(b.shipmentTitle, "ru");
  });
}

export function productGroupKey(slot: Pick<CartonSlot, "productId" | "productName" | "productCode" | "productArticle" | "supplierName">) {
  if (slot.productId) return `id:${slot.productId}`;
  const code = slot.productCode.trim().toLowerCase();
  if (code) return `code:${code}`;
  const article = slot.productArticle.trim().toLowerCase();
  if (article) return `article:${article}`;
  return `name:${slot.productName.trim().toLowerCase()}|${slot.supplierName.trim().toLowerCase()}`;
}

export function matchesStockQuery(
  slot: CartonSlot,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    slot.productName,
    slot.productCode,
    slot.productArticle,
    slot.supplierName,
    slot.shipmentTitle,
    String(slot.cartonNo),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function allocateQtyAcrossCartons(
  qty: number,
  cartons: SelectedCarton[],
): { packingItemId: string; shipmentId: string; cartonNo: number; qty: number }[] {
  if (qty <= 0) throw new Error("Количество должно быть больше 0");
  if (cartons.length === 0) throw new Error("Выберите хотя бы одну коробку");

  const ordered = [...cartons].sort((a, b) => {
    if (a.cartonNo !== b.cartonNo) return a.cartonNo - b.cartonNo;
    return a.packingItemId.localeCompare(b.packingItemId);
  });

  const capacity = ordered.reduce((sum, c) => sum + c.available, 0);
  if (capacity + 1e-9 < qty) {
    throw new Error(
      `Недостаточно товара в выбранных коробках: нужно ${qty}, доступно ${roundQty(capacity)}`,
    );
  }

  let remaining = qty;
  const result: {
    packingItemId: string;
    shipmentId: string;
    cartonNo: number;
    qty: number;
  }[] = [];

  for (const carton of ordered) {
    if (remaining <= 1e-9) break;
    const take = roundQty(Math.min(carton.available, remaining));
    if (take <= 0) continue;
    result.push({
      packingItemId: carton.packingItemId,
      shipmentId: carton.shipmentId,
      cartonNo: carton.cartonNo,
      qty: take,
    });
    remaining = roundQty(remaining - take);
  }

  if (remaining > 1e-6) {
    throw new Error("Не удалось распределить количество по коробкам");
  }

  return result;
}

export function remainingPcsForItem(
  item: PackingItemCartonSource,
  usedByKey: Record<string, number>,
): number | null {
  const cartonNos = expandItemCartons(item);
  if (cartonNos.length === 0) {
    if (item.totalPcs == null) return null;
    return item.totalPcs;
  }
  const initial = initialQtyPerCarton(item);
  let remaining = 0;
  for (const cartonNo of cartonNos) {
    const used = usedByKey[allocationKey(item.id, cartonNo)] ?? 0;
    remaining += Math.max(0, initial - used);
  }
  return roundQty(remaining);
}

export function validateTransferLines(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  lines: TransferLineInput[];
  slots: CartonSlot[];
}) {
  if (!input.fromWarehouseId || !input.toWarehouseId) {
    throw new Error("Укажите склад-источник и склад-получатель");
  }
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Склад-источник и склад-получатель должны отличаться");
  }
  if (input.lines.length === 0) {
    throw new Error("Добавьте хотя бы один товар");
  }

  const slotMap = new Map(
    input.slots.map((s) => [allocationKey(s.packingItemId, s.cartonNo), s]),
  );

  // Prevent double-use of the same carton across lines in one transfer
  const reserved = new Map<string, number>();

  return input.lines.map((line, index) => {
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Строка ${index + 1}: укажите количество больше 0`);
    }
    if (!line.productName?.trim()) {
      throw new Error(`Строка ${index + 1}: укажите название товара`);
    }
    if (!Array.isArray(line.cartons) || line.cartons.length === 0) {
      throw new Error(`Строка ${index + 1}: выберите коробки`);
    }

    const selected: SelectedCarton[] = line.cartons.map((c) => {
      const key = allocationKey(c.packingItemId, c.cartonNo);
      const slot = slotMap.get(key);
      if (!slot) {
        throw new Error(
          `Строка ${index + 1}: коробка ${c.cartonNo} недоступна или уже израсходована`,
        );
      }
      if (slot.shipmentId !== c.shipmentId) {
        throw new Error(`Строка ${index + 1}: неверная привязка коробки к поставке`);
      }
      const already = reserved.get(key) ?? 0;
      const available = roundQty(slot.available - already);
      if (available <= 0) {
        throw new Error(
          `Строка ${index + 1}: коробка ${c.cartonNo} уже использована в этом перемещении`,
        );
      }
      return {
        packingItemId: c.packingItemId,
        shipmentId: c.shipmentId,
        cartonNo: c.cartonNo,
        available,
      };
    });

    const allocations = allocateQtyAcrossCartons(qty, selected);
    for (const a of allocations) {
      const key = allocationKey(a.packingItemId, a.cartonNo);
      reserved.set(key, roundQty((reserved.get(key) ?? 0) + a.qty));
    }

    return {
      productId: line.productId || null,
      productName: line.productName.trim(),
      productCode: (line.productCode || "").trim(),
      productArticle: (line.productArticle || "").trim(),
      qty,
      sortOrder: index,
      allocations,
    };
  });
}
