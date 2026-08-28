"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function DeleteTransferButton({
  transferId,
  label,
}: {
  transferId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось удалить");
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
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[#c62828] hover:bg-[#fdeceb]"
      >
        Удалить
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/45"
                onClick={() => !deleting && setOpen(false)}
              />
              <div className="relative w-full max-w-sm rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
                <div className="text-sm font-semibold">Удаление перемещения</div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Вы действительно хотите удалить перемещение?
                </p>
                <p className="mt-1 text-sm font-medium">{label}</p>
                {error ? <p className="mt-2 text-sm text-[#c62828]">{error}</p> : null}
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
      <Link
        href={`/transfers/${transferId}/edit`}
        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface)]"
      >
        Изменить
      </Link>
    </>
  );
}
