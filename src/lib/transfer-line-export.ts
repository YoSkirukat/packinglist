export type TransferLineExportRow = {
  photoUrl: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName: string;
  qty: number;
  cartonLabel: string;
};

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, "_").slice(0, 40) || "sklad";
}

export function transferLineExportFilename(fromWarehouse: string, toWarehouse: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `peremeshenie-${sanitizeFilenamePart(fromWarehouse)}-${sanitizeFilenamePart(toWarehouse)}-${date}.xlsx`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function exportTransferLinesToExcel(
  rows: TransferLineExportRow[],
  fromWarehouse: string,
  toWarehouse: string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Перемещение");

  sheet.columns = [
    { header: "Фото", key: "photo", width: 12 },
    { header: "Название", key: "name", width: 45 },
    { header: "Кол-во", key: "qty", width: 10 },
    { header: "Коробка", key: "carton", width: 16 },
    { header: "Баркод", key: "barcode", width: 20 },
    { header: "Короб WB", key: "boxWb", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getColumn("qty").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getColumn("carton").alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  sheet.getColumn("barcode").numFmt = "@";
  sheet.getColumn("boxWb").numFmt = "@";

  const thinBorder = { style: "thin" as const, color: { argb: "FFB0B0B0" } };
  const allBorders = {
    top: thinBorder,
    left: thinBorder,
    bottom: thinBorder,
    right: thinBorder,
  };
  for (let col = 1; col <= sheet.columns.length; col++) {
    sheet.getRow(1).getCell(col).border = allBorders;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Собираем название из нескольких строк: имя товара, код · артикул,
    // китайское название. Каждое значение выводится на отдельной строке.
    const nameLines = [row.productName];
    const nameDetails = [row.productCode, row.productArticle].filter(Boolean).join(" · ");
    if (nameDetails) nameLines.push(nameDetails);
    if (row.supplierName && row.supplierName !== row.productName) {
      nameLines.push(row.supplierName);
    }
    const nameValue = nameLines.join("\n");
    const cartonLines = row.cartonLabel.split("\n").filter(Boolean);

    const excelRow = sheet.addRow({
      name: nameValue,
      qty: row.qty,
      carton: row.cartonLabel,
    });
    // Высота строки подстраивается под количество строк в ячейках, но не
    // меньше минимума, чтобы вместить фото товара.
    const visualLines = Math.max(1, nameLines.length, cartonLines.length);
    excelRow.height = Math.max(58, visualLines * 15 + 8);
    excelRow.getCell("name").alignment = { vertical: "middle", wrapText: true };
    for (let col = 1; col <= sheet.columns.length; col++) {
      excelRow.getCell(col).border = allBorders;
    }

    if (row.photoUrl) {
      try {
        const res = await fetch(row.photoUrl);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          const extension = contentType.includes("png") ? "png" : "jpeg";
          const base64 = arrayBufferToBase64(await res.arrayBuffer());
          const imageId = workbook.addImage({ base64: `data:image/${extension};base64,${base64}`, extension });
          sheet.addImage(imageId, {
            tl: { col: 0.12, row: i + 1.08 },
            ext: { width: 54, height: 54 },
          });
        }
      } catch {
        // фото недоступно — оставляем ячейку пустой
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = transferLineExportFilename(fromWarehouse, toWarehouse);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
