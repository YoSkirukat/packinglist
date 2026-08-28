"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ProductPhotoPreview({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] p-0 hover:border-[#d5d9e0]"
        title="Открыть фото"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-14 w-14 cursor-pointer object-contain" />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={alt}
            >
              <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 z-[1101] flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl leading-none text-[var(--text)] hover:bg-[var(--surface)]"
                aria-label="Закрыть"
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="relative z-[1101] max-h-[90vh] max-w-[min(960px,92vw)] rounded-lg bg-white object-contain shadow-lg"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
