"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export function DeleteShipmentButton({
  shipmentId,
  shipmentTitle,
}: {
  shipmentId: string;
  shipmentTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось удалить поставку");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title="Удалить поставку"
        aria-label={`Удалить поставку ${shipmentTitle}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[#c62828] hover:bg-[#fdeceb]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`delete-shipment-${shipmentId}`}
            >
              <div
                className="absolute inset-0 bg-black/45"
                onClick={() => !deleting && setOpen(false)}
              />
              <div className="relative w-full max-w-sm rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
                <div
                  id={`delete-shipment-${shipmentId}`}
                  className="text-sm font-semibold"
                >
                  Удаление поставки
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Вы действительно хотите удалить поставку?
                </p>
                <p className="mt-1 text-sm font-medium">{shipmentTitle}</p>
                {error ? (
                  <p className="mt-2 text-sm text-[#c62828]">{error}</p>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm disabled:opacity-60"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={confirmDelete}
                    className="rounded-lg bg-[#c62828] px-3.5 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
                  >
                    {deleting ? "Удаление…" : "Удалить"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
