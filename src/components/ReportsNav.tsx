"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const REPORTS = [
  { href: "/reports/shipping-cost", label: "Стоимость отправок" },
];

export function ReportsNav({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isActive = Boolean(active?.startsWith("/reports"));

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`relative whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
          isActive
            ? "bg-[var(--surface)] font-medium text-[var(--text)]"
            : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
        }`}
      >
        Отчеты
        <span className="ml-1 inline-block text-[10px] opacity-70">▾</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
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
        </div>
      ) : null}
    </div>
  );
}
