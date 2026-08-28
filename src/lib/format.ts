import { format } from "date-fns";
import { ru } from "date-fns/locale";

export function formatDateTime(value?: Date | string | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd.MM.yyyy, HH:mm", { locale: ru });
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd.MM.yyyy", { locale: ru });
}

export function formatNumber(value?: number | null, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function shipmentStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Черновик",
    uploaded: "Пакинг-лист загружен",
  };
  return map[status] ?? status;
}

export function shipmentStatusTone(status: string): "default" | "ok" | "warn" | "info" {
  if (status === "uploaded") return "ok";
  if (status === "draft") return "warn";
  return "default";
}
