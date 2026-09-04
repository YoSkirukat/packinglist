"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "@/lib/format";

export type CartonSelectOption = {
  packingItemId: string;
  shipmentId: string;
  shipmentTitle: string;
  cartonNo: number;
  available: number;
};

function cartonOptionKey(c: Pick<CartonSelectOption, "packingItemId" | "cartonNo">) {
  return `${c.packingItemId}:${c.cartonNo}`;
}

function BoxIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function needsShipmentLabel(cartons: CartonSelectOption[]) {
  const byNo = new Map<number, Set<string>>();
  for (const c of cartons) {
    const set = byNo.get(c.cartonNo) ?? new Set();
    set.add(c.shipmentId);
    byNo.set(c.cartonNo, set);
  }
  return [...byNo.values()].some((set) => set.size > 1);
}

export function CartonSelect({
  cartons,
  selectedKeys,
  onToggle,
  disabled,
}: {
  cartons: CartonSelectOption[];
  selectedKeys: string[];
  onToggle: (carton: CartonSelectOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const showShip = needsShipmentLabel(cartons) || cartons.length > 1;

  const selected = cartons.filter((c) =>
    selectedKeys.includes(cartonOptionKey(c)),
  );

  function updatePosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setMenuPos({ top: rect.bottom + 4, left, width });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || cartons.length === 0}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="field flex min-w-[180px] items-center gap-2 py-1.5 text-left disabled:opacity-60"
      >
        <span className="min-w-0 flex-1 truncate text-sm">
          {selected.length === 0 ? (
            <span className="text-[var(--muted)]">Выберите коробку</span>
          ) : selected.length === 1 ? (
            <span className="inline-flex items-center gap-1.5">
              <BoxIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
              <span className="font-semibold">{selected[0].cartonNo}</span>
              <span className="text-[var(--muted)]">
                ({formatNumber(selected[0].available)} шт)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <BoxIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
              <span className="font-semibold">
                {selected.map((c) => c.cartonNo).join(", ")}
              </span>
            </span>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-[var(--muted)]">▾</span>
      </button>

      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-multiselectable
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
              className="fixed z-[2000] max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
            >
              {cartons.map((carton) => {
                const key = cartonOptionKey(carton);
                const checked = selectedKeys.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-[var(--surface)] ${
                      checked ? "bg-[var(--surface)]" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => onToggle(carton)}
                      disabled={disabled}
                    />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="inline-flex items-center gap-1.5">
                        <BoxIcon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                        <span className="font-semibold">{carton.cartonNo}</span>
                        <span className="text-[var(--muted)]">
                          ({formatNumber(carton.available)} шт)
                        </span>
                      </span>
                      {showShip ? (
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {carton.shipmentTitle}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
