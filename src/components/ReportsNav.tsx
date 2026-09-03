"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const REPORTS = [
  { href: "/reports/shipping-cost", label: "Стоимость отправок" },
];

export function ReportsNav({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isActive = Boolean(active?.startsWith("/reports"));

  function updatePosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
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
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`relative shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
          isActive
            ? "bg-[var(--surface)] font-medium text-[var(--text)]"
            : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
        }`}
      >
        Отчеты
        <span className="ml-1 inline-block text-[10px] opacity-70">▾</span>
      </button>
      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[2000] min-w-[200px] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
            >
              {REPORTS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-sm hover:bg-[var(--surface)] ${
                    active?.startsWith(item.href)
                      ? "font-medium text-[var(--text)]"
                      : "text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
