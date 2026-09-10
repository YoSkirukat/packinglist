export type PendingTransferCarton = {
  packingItemId: string;
  shipmentId: string;
  shipmentTitle: string;
  cartonNo: number;
  available: number;
};

export type PendingTransferLine = {
  key: string;
  productId: string | null;
  productName: string;
  productCode: string;
  productArticle: string;
  supplierName?: string;
  photoUrl: string | null;
  qty: number;
  cartons: PendingTransferCarton[];
};

export type PendingTransferDraft = {
  warehouseId: string;
  warehouseName: string;
  lines: PendingTransferLine[];
};

const STORAGE_KEY = "packinglist:pending-transfer";

export function loadPendingTransfer(): PendingTransferDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTransferDraft;
    if (!parsed || !parsed.warehouseId || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePendingTransfer(draft: PendingTransferDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota/serialization errors
  }
}

export function clearPendingTransfer() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
