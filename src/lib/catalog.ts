import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  expandMultiProductItem,
  mappingLookupKeys,
  splitSupplierProducts,
  type ParsedPackingItem,
} from "@/lib/packing-list";

export type ParsedCatalogProduct = {
  code: string;
  article: string;
  name: string;
};

type ColumnKey = "code" | "article" | "name";

const HEADER_PATTERNS: { key: ColumnKey; tests: RegExp[] }[] = [
  { key: "code", tests: [/код\s*товара/, /^код$/, /code/, /\bsku\b/] },
  { key: "article", tests: [/артикул/, /^арт\.?$/, /article/, /\bart\b/] },
  { key: "name", tests: [/название/, /наимен/, /^name$/, /товар/] },
];

export function productSearchText(code: string, article: string, name: string) {
  return [code, article, name].join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function matchHeader(text: string): ColumnKey | null {
  const n = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!n) return null;
  for (const { key, tests } of HEADER_PATTERNS) {
    if (tests.some((re) => re.test(n))) return key;
  }
  return null;
}

export function parseCatalogExcel(buffer: Buffer): ParsedCatalogProduct[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("В файле нет листов");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Не удалось прочитать лист");

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  if (rows.length === 0) throw new Error("Файл с товарами пустой");

  let headerRow = 0;
  let map: Partial<Record<ColumnKey, number>> = {};
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const row = (rows[i] ?? []).map(cellText);
    const next: Partial<Record<ColumnKey, number>> = {};
    let score = 0;
    row.forEach((value, col) => {
      const key = matchHeader(value);
      if (!key || next[key] != null) return;
      next[key] = col;
      score += key === "code" || key === "name" ? 3 : 1;
    });
    if (score > bestScore) {
      bestScore = score;
      headerRow = i;
      map = next;
    }
  }

  if (!map.code || !map.name) {
    map = { code: 0, article: 1, name: 2 };
    headerRow = bestScore > 0 ? headerRow : -1;
  }

  const start = headerRow + 1;
  const products = new Map<string, ParsedCatalogProduct>();

  for (let i = start; i < rows.length; i += 1) {
    const row = (rows[i] ?? []).map(cellText);
    const code = (row[map.code ?? 0] ?? "").trim();
    const article = (row[map.article ?? 1] ?? "").trim();
    const name = (row[map.name ?? 2] ?? "").trim();
    if (!code || !name) continue;
    if (matchHeader(code) === "code" && matchHeader(name) === "name") continue;
    products.set(code, { code, article, name });
  }

  if (products.size === 0) {
    throw new Error(
      "Не удалось найти товары. Нужны колонки: Код товара, Артикул, Название.",
    );
  }

  return [...products.values()];
}

export async function getSettings() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: 1 } });
  }
  return settings;
}

export async function applyMappingsToItems<
  T extends { supplierName: string; supplierKey?: string; pcsPerCarton?: number | null },
>(items: T[]) {
  const keys = [
    ...new Set(
      items.flatMap((item) => mappingLookupKeys(item.supplierName, item.pcsPerCarton)),
    ),
  ].filter(Boolean);

  if (keys.length === 0) {
    return items.map((item) => ({
      ...item,
      mappedName: "",
      mappedCode: "",
      mappedArticle: "",
      productId: null as string | null,
    }));
  }

  const mappings = await prisma.productMapping.findMany({
    where: { supplierKey: { in: keys } },
    include: { product: true },
  });
  const byKey = new Map(mappings.map((row) => [row.supplierKey, row]));

  return items.map((item) => {
    const mapped = mappingLookupKeys(item.supplierName, item.pcsPerCarton)
      .map((key) => byKey.get(key))
      .find((row) => row?.product);
    if (!mapped?.product) {
      return {
        ...item,
        mappedName: "",
        mappedCode: "",
        mappedArticle: "",
        productId: null as string | null,
      };
    }
    return {
      ...item,
      mappedName: mapped.product.name,
      mappedCode: mapped.product.code,
      mappedArticle: mapped.product.article,
      productId: mapped.product.id,
    };
  });
}

export async function ensureSplitPackingItems(shipmentId: string) {
  const items = await prisma.packingItem.findMany({
    where: { shipmentId },
    orderBy: { lineNo: "asc" },
  });
  if (items.length === 0) return false;

  const needsRewrite = items.some((item) => {
    if (item.nameLocked) return false;
    const parts = splitSupplierProducts(item.supplierName);
    if (parts.length > 1) return true;
    return parts.length === 1 && parts[0]!.name !== item.supplierName.trim();
  });
  if (!needsRewrite) return false;

  const expanded: ParsedPackingItem[] = [];
  for (const item of items) {
    if (item.nameLocked) {
      expanded.push({
        lineNo: item.lineNo,
        cartonLabel: item.cartonLabel,
        cartonFrom: item.cartonFrom,
        cartonTo: item.cartonTo,
        mark: item.mark,
        supplierName: item.supplierName,
        supplierKey: item.supplierKey,
        pcsPerCarton: item.pcsPerCarton,
        totalPcs: item.totalPcs,
        totalCartons: item.totalCartons,
        grossWeightPerCarton: item.grossWeightPerCarton,
        totalGrossWeight: item.totalGrossWeight,
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        volumeCbm: item.volumeCbm,
        totalCbm: item.totalCbm,
      });
      continue;
    }
    expanded.push(
      ...expandMultiProductItem({
        lineNo: item.lineNo,
        cartonLabel: item.cartonLabel,
        cartonFrom: item.cartonFrom,
        cartonTo: item.cartonTo,
        mark: item.mark,
        supplierName: item.supplierName,
        supplierKey: item.supplierKey,
        pcsPerCarton: item.pcsPerCarton,
        totalPcs: item.totalPcs,
        totalCartons: item.totalCartons,
        grossWeightPerCarton: item.grossWeightPerCarton,
        totalGrossWeight: item.totalGrossWeight,
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        volumeCbm: item.volumeCbm,
        totalCbm: item.totalCbm,
      }),
    );
  }

  const numbered = expanded.map((item, index) => ({ ...item, lineNo: index + 1 }));
  const lockedByKey = new Map(
    items.filter((item) => item.nameLocked).map((item) => [item.supplierKey, item]),
  );
  const mapped = await applyMappingsToItems(numbered);

  await prisma.$transaction([
    prisma.packingItem.deleteMany({ where: { shipmentId } }),
    prisma.packingItem.createMany({
      data: mapped.map((item) => {
        const locked = lockedByKey.get(item.supplierKey);
        return {
          shipmentId,
          ...item,
          nameLocked: locked?.nameLocked ?? false,
          mappedName: locked?.mappedName || item.mappedName,
          mappedCode: locked?.mappedCode || item.mappedCode,
          mappedArticle: locked?.mappedArticle || item.mappedArticle,
          productId: locked?.productId ?? item.productId,
        };
      }),
    }),
  ]);

  return true;
}
