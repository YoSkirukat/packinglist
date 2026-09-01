import * as XLSX from "xlsx";

export type StockExportProduct = {
  productName: string;
  supplierName: string;
  productCode: string;
  productArticle: string;
  availableTotal: number;
  cartonCount: number;
};

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, "_").slice(0, 60) || "sklad";
}

export function stockExportFilename(warehouseName: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `ostatki-${sanitizeFilenamePart(warehouseName)}-${date}.xlsx`;
}

export function exportStockToExcel(
  products: StockExportProduct[],
  warehouseName: string,
) {
  const rows = products.map((product) => ({
    Название: product.productName,
    "Китайское название": product.supplierName,
    "Код товара": product.productCode,
    Артикул: product.productArticle,
    Остаток: product.availableTotal,
    Коробок: product.cartonCount,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Остатки");
  XLSX.writeFile(book, stockExportFilename(warehouseName));
}
