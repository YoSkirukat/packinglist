export type TransferLineExportRow = {
  photoUrl: string | null;
  productName: string;
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
  sheet.getColumn("barcode").numFmt = "@";
  sheet.getColumn("boxWb").numFmt = "@";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const excelRow = sheet.addRow({
      name: row.productName,
      qty: row.qty,
      carton: row.cartonLabel,
    });
    excelRow.height = 58;
    excelRow.alignment = { vertical: "middle", wrapText: true };

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
