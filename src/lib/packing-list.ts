import { unzipSync } from "fflate";

export type ParsedPackingItem = {
  lineNo: number;
  cartonLabel: string;
  cartonFrom: number | null;
  cartonTo: number | null;
  mark: string;
  supplierName: string;
  supplierKey: string;
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

type ColumnKey =
  | "carton"
  | "mark"
  | "model"
  | "pcsPerCarton"
  | "totalPcs"
  | "totalCartons"
  | "gwPerCarton"
  | "totalGw"
  | "length"
  | "width"
  | "height"
  | "size"
  | "volume"
  | "totalCbm";

type ColumnMap = Partial<Record<ColumnKey, number>>;

const HEADER_PATTERNS: { key: ColumnKey; tests: RegExp[] }[] = [
  { key: "pcsPerCarton", tests: [/pcs\s*\/\s*carton/, /pcs\/ctn/, /qty\/ctn/, /шт\s*\/\s*кор/] },
  { key: "totalPcs", tests: [/total\s*pcs/, /total\s*qty/, /всего\s*шт/] },
  { key: "totalCartons", tests: [/total\s*carton/, /total\s*ctn/, /всего\s*кор/] },
  { key: "gwPerCarton", tests: [/gross\s*weight\s*\/\s*carton/, /gw\s*\/\s*(ctn|carton)/, /вес.*кор/] },
  { key: "totalGw", tests: [/total\s*gross/, /total\s*weight/, /total\s*gw/, /общий\s*вес/, /всего.*кг/] },
  { key: "totalCbm", tests: [/total\s*cbm/, /total\s*volume/, /всего.*cbm/, /общий\s*объ/] },
  { key: "volume", tests: [/volume\s*\/\s*cbm/, /^cbm$/, /объ[её]м/] },
  { key: "size", tests: [/ctn\s*size/, /carton\s*size/, /size\s*\(cm\)/, /габарит/, /размер/] },
  { key: "carton", tests: [/^carton\s*no/, /^ctn\s*no/, /^коробк/] },
  { key: "mark", tests: [/^mark$/, /маркир/, /^марк/] },
  { key: "model", tests: [/^model/, /description/, /item\s*name/, /наимен/, /товар/] },
  { key: "length", tests: [/^l$/, /^len/, /^length$/, /длина/] },
  { key: "width", tests: [/^w$/, /^wid/, /^width$/, /ширина/] },
  { key: "height", tests: [/^h$/, /^hei/, /^height$/, /высота/] },
];

const FALLBACK_MAP: ColumnMap = {
  carton: 1,
  mark: 2,
  model: 3,
  pcsPerCarton: 4,
  totalPcs: 5,
  totalCartons: 6,
  gwPerCarton: 7,
  totalGw: 8,
  length: 9,
  width: 10,
  height: 11,
  volume: 12,
  totalCbm: 13,
};

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? "";
}

function colNumber(ref: string) {
  const letters = ref.replace(/\d/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function innerTags(xml: string, tag: string) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1] ?? "");
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  return innerTags(xml, "si").map((block) =>
    normalizeSpace(
      [...block.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((m) => decodeXmlEntities(m[1] ?? ""))
        .join(""),
    ),
  );
}

function cellText(cellXml: string, shared: string[]) {
  const open = cellXml.match(/^<c\b[^>]*>/)?.[0] ?? "";
  const type = attr(open, "t");
  if (type === "s") {
    const v = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
    const i = Number(v);
    return Number.isInteger(i) ? (shared[i] ?? "") : "";
  }
  if (type === "inlineStr") {
    return normalizeSpace(
      [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
        .map((m) => decodeXmlEntities(m[1] ?? ""))
        .join(""),
    );
  }
  const v = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
  return v ? normalizeSpace(decodeXmlEntities(v)) : "";
}

function sheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  for (const rowMatch of xml.matchAll(rowRe)) {
    const body = rowMatch[1] ?? "";
    const values: string[] = [];
    let maxCol = 0;
    const cellRe = /<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g;
    for (const cellXml of body.match(cellRe) ?? []) {
      const open = cellXml.match(/^<c\b[^>]*>?/)?.[0] ?? "";
      const ref = attr(open, "r");
      const col = colNumber(ref);
      if (!col) continue;
      maxCol = Math.max(maxCol, col);
      values[col] = cellText(cellXml, shared);
    }
    const line: string[] = [];
    for (let c = 1; c <= maxCol; c += 1) line[c] = values[c] ?? "";
    rows.push(line);
  }
  return rows;
}

function extractSheetXml(buffer: Buffer) {
  const unzipped = unzipSync(new Uint8Array(buffer), {
    filter: (file) => {
      const name = file.name.replaceAll("\\", "/");
      return (
        name === "xl/sharedStrings.xml" ||
        /^xl\/worksheets\/sheet\d+\.xml$/.test(name)
      );
    },
  });

  const names = Object.keys(unzipped).map((n) => n.replaceAll("\\", "/")).sort();
  const sheetName = names.find((n) => n === "xl/worksheets/sheet1.xml")
    || names.find((n) => n.startsWith("xl/worksheets/sheet"));
  if (!sheetName) {
    throw new Error("В файле нет листа Excel");
  }

  const fileName = Object.keys(unzipped).find(
    (n) => n.replaceAll("\\", "/") === sheetName,
  )!;
  const sharedFile = Object.keys(unzipped).find(
    (n) => n.replaceAll("\\", "/") === "xl/sharedStrings.xml",
  );

  const decoder = new TextDecoder("utf-8");
  return {
    sheetXml: decoder.decode(unzipped[fileName]),
    sharedXml: sharedFile ? decoder.decode(unzipped[sharedFile]) : "",
  };
}

function normalizeHeader(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchHeader(text: string): ColumnKey | null {
  const n = normalizeHeader(text);
  if (!n) return null;
  for (const { key, tests } of HEADER_PATTERNS) {
    if (tests.some((re) => re.test(n))) return key;
  }
  return null;
}

function parseNumber(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCartonRange(label: string): { from: number | null; to: number | null } {
  const nums = [...label.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  if (nums.length === 0) return { from: null, to: null };
  if (nums.length === 1) return { from: nums[0]!, to: nums[0]! };
  return { from: Math.min(...nums), to: Math.max(...nums) };
}

function parseSize(text: string): { l: number | null; w: number | null; h: number | null } {
  const parts = text
    .split(/[xх×*]/i)
    .map((part) => parseNumber(part.trim()))
    .filter((n): n is number => n != null);
  return {
    l: parts[0] ?? null,
    w: parts[1] ?? null,
    h: parts[2] ?? null,
  };
}

function looksLikeTotalRow(model: string, carton: string) {
  const t = `${model} ${carton}`.toLowerCase();
  return /^(total|итого|всего|grand total)\b/.test(t.trim()) || t.includes("grand total");
}

export function normalizeSupplierName(name: string) {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

export type SupplierProductPart = {
  name: string;
  qty: number | null;
};

export function splitSupplierProducts(model: string): SupplierProductPart[] {
  const text = model.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const parts: SupplierProductPart[] = [];
  // *100, *100m, *100meters, *100 метров — количество в коробке, не часть названия
  const re = /(.+?)\s*\*\s*(\d+)\s*(?:m(?:eters?|etres?)?|метр(?:ов|а)?|м)?(?=\s|$)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const name = match[1]!.replace(/\s+/g, " ").trim();
    const qty = Number(match[2]);
    if (name) parts.push({ name, qty: Number.isFinite(qty) ? qty : null });
    lastIndex = re.lastIndex;
  }

  const rest = text.slice(lastIndex).trim();
  if (parts.length === 0) {
    return [{ name: text, qty: null }];
  }
  if (rest) parts.push({ name: rest, qty: null });
  return parts;
}

export function mappingLookupKeys(name: string, pcsPerCarton?: number | null) {
  const keys = new Set<string>();
  const add = (value: string) => {
    const key = normalizeSupplierName(value);
    if (key) keys.add(key);
  };
  add(name);
  if (pcsPerCarton != null && Number.isFinite(pcsPerCarton)) {
    const qty = Number.isInteger(pcsPerCarton) ? String(pcsPerCarton) : String(pcsPerCarton);
    add(`${name}*${qty}`);
  }
  for (const part of splitSupplierProducts(name)) {
    add(part.name);
    if (part.qty != null) add(`${part.name}*${part.qty}`);
  }
  return [...keys];
}

export function expandMultiProductItem(base: ParsedPackingItem): ParsedPackingItem[] {
  const parts = splitSupplierProducts(base.supplierName);
  if (parts.length === 0) return [base];

  const cartons = base.totalCartons;
  const onlyOne = parts.length === 1;

  return parts.map((part, index) => {
    const keepBoxMetrics = onlyOne || index === 0;
    const pcsPerCarton = part.qty ?? (onlyOne ? base.pcsPerCarton : null);
    const totalPcs =
      pcsPerCarton != null && cartons != null
        ? pcsPerCarton * cartons
        : onlyOne && part.qty == null
          ? base.totalPcs
          : pcsPerCarton;

    return {
      ...base,
      supplierName: part.name,
      supplierKey: normalizeSupplierName(part.name),
      pcsPerCarton,
      totalPcs,
      totalCartons: keepBoxMetrics ? base.totalCartons : null,
      grossWeightPerCarton: keepBoxMetrics ? base.grossWeightPerCarton : null,
      totalGrossWeight: keepBoxMetrics ? base.totalGrossWeight : null,
      volumeCbm: keepBoxMetrics ? base.volumeCbm : null,
      totalCbm: keepBoxMetrics ? base.totalCbm : null,
    };
  });
}

function detectHeader(rows: string[][]): { headerRow: number; map: ColumnMap } | null {
  let best: { score: number; headerRow: number; map: ColumnMap } | null = null;

  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const values = rows[i] ?? [];
    const map: ColumnMap = {};
    let score = 0;
    const maxCol = values.length - 1;

    for (let col = 1; col <= maxCol; col += 1) {
      const key = matchHeader(values[col] ?? "");
      if (!key || map[key]) continue;
      map[key] = col;
      score += key === "model" || key === "carton" || key === "totalCartons" ? 3 : 1;
    }

    const next = rows[i + 1];
    if (next) {
      for (let col = 1; col < next.length; col += 1) {
        const key = matchHeader(next[col] ?? "");
        if (key && (key === "length" || key === "width" || key === "height") && !map[key]) {
          map[key] = col;
          score += 1;
        }
      }
    }

    if (!best || score > best.score) {
      best = { score, headerRow: i, map };
    }
  }

  if (!best || best.score < 4 || !best.map.model) return null;
  return { headerRow: best.headerRow, map: best.map };
}

function pick(values: string[], map: ColumnMap, key: ColumnKey) {
  const col = map[key];
  if (!col) return "";
  return values[col] ?? "";
}

export async function parsePackingList(buffer: Buffer): Promise<ParsedPackingItem[]> {
  const { sheetXml, sharedXml } = extractSheetXml(buffer);
  const shared = parseSharedStrings(sharedXml);
  const rows = sheetRows(sheetXml, shared);

  if (rows.length === 0) {
    throw new Error("Файл пустой");
  }

  const detected = detectHeader(rows);
  const map = detected?.map ?? FALLBACK_MAP;
  let startIndex = detected ? detected.headerRow + 1 : 0;

  if (detected) {
    const next = rows[detected.headerRow + 1] ?? [];
    const isSubHeader = next.some((v) => /^(l|w|h|length|width|height)$/i.test((v ?? "").trim()));
    if (isSubHeader) startIndex = detected.headerRow + 2;
  }

  const items: ParsedPackingItem[] = [];
  let emptyStreak = 0;

  for (let i = startIndex; i < rows.length; i += 1) {
    const values = rows[i] ?? [];
    const supplierName = pick(values, map, "model");
    const cartonLabel = pick(values, map, "carton");
    const mark = pick(values, map, "mark");
    const filled = values.filter((v) => v).length;

    if (!supplierName && !cartonLabel) {
      emptyStreak += 1;
      if (emptyStreak >= 4) break;
      continue;
    }
    emptyStreak = 0;

    if (!supplierName) continue;
    if (looksLikeTotalRow(supplierName, cartonLabel)) continue;
    if (filled <= 1 && !parseNumber(supplierName) && supplierName.length < 3) continue;

    const sizeText = pick(values, map, "size");
    const size = parseSize(sizeText);
    const carton = parseCartonRange(cartonLabel);
    const totalCartons = parseNumber(pick(values, map, "totalCartons"));
    const pcsPerCarton = parseNumber(pick(values, map, "pcsPerCarton"));
    const totalPcs = parseNumber(pick(values, map, "totalPcs"));
    const gwPerCarton = parseNumber(pick(values, map, "gwPerCarton"));
    const totalGw = parseNumber(pick(values, map, "totalGw"));
    const volume = parseNumber(pick(values, map, "volume"));
    const totalCbm = parseNumber(pick(values, map, "totalCbm"));
    const lengthCm = parseNumber(pick(values, map, "length")) ?? size.l;
    const widthCm = parseNumber(pick(values, map, "width")) ?? size.w;
    const heightCm = parseNumber(pick(values, map, "height")) ?? size.h;

    const expanded = expandMultiProductItem({
      lineNo: items.length + 1,
      cartonLabel,
      cartonFrom: carton.from,
      cartonTo: carton.to,
      mark,
      supplierName,
      supplierKey: normalizeSupplierName(supplierName),
      pcsPerCarton,
      totalPcs:
        totalPcs ??
        (pcsPerCarton != null && totalCartons != null ? pcsPerCarton * totalCartons : null),
      totalCartons:
        totalCartons ??
        (carton.from != null && carton.to != null ? carton.to - carton.from + 1 : null),
      grossWeightPerCarton: gwPerCarton,
      totalGrossWeight:
        totalGw ??
        (gwPerCarton != null && totalCartons != null ? gwPerCarton * totalCartons : null),
      lengthCm,
      widthCm,
      heightCm,
      volumeCbm: volume,
      totalCbm:
        totalCbm ?? (volume != null && totalCartons != null ? volume * totalCartons : null),
    });
    items.push(...expanded);
  }

  if (items.length === 0) {
    throw new Error(
      "Не удалось найти строки товаров. Проверьте, что в файле есть колонки Model / Carton No.",
    );
  }

  return items.map((item, index) => ({ ...item, lineNo: index + 1 }));
}

export function summarizeItems(items: {
  totalPcs?: number | null;
  totalCartons?: number | null;
  totalGrossWeight?: number | null;
  totalCbm?: number | null;
}[]) {
  return items.reduce(
    (acc, item) => {
      acc.positions += 1;
      acc.pcs += item.totalPcs ?? 0;
      acc.cartons += item.totalCartons ?? 0;
      acc.kg += item.totalGrossWeight ?? 0;
      acc.cbm += item.totalCbm ?? 0;
      return acc;
    },
    { positions: 0, pcs: 0, cartons: 0, kg: 0, cbm: 0 },
  );
}
