import * as XLSX from "xlsx";

export type ShippingCostExportRow = {
  date: string;
  note: string;
  fromWarehouse: string;
  toWarehouse: string;
  productName: string;
  qty: number;
};

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, "_").slice(0, 40) || "period";
}

export function shippingCostExportFilename(dateFrom: string, dateTo: string) {
  return `stoimost-otpravok-${sanitizeFilenamePart(dateFrom)}-${sanitizeFilenamePart(dateTo)}.xlsx`;
}

export function exportShippingCostToExcel(
  rows: ShippingCostExportRow[],
  dateFrom: string,
  dateTo: string,
) {
  const sheetRows = rows.map((row) => ({
    Дата: row.date,
    Комментарий: row.note,
    Откуда: row.fromWarehouse,
    Куда: row.toWarehouse,
    Наименование: row.productName,
    "Кол-во": row.qty,
  }));

  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Перемещения");
  XLSX.writeFile(book, shippingCostExportFilename(dateFrom, dateTo));
}
