"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime } from "@/lib/format";

type LogItem = {
  id: string;
  message: string;
  createdAt: string | Date;
};

export function ActivityLogButton({ logs }: { logs: LogItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
      >
        Логирование
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 pt-[8vh]"
              role="dialog"
              aria-modal="true"
            >
              <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
              <div className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-white p-5 shadow-lg">
                <div className="text-sm font-semibold">История действий</div>
                {logs.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">Пока нет записей</p>
                ) : (
                  <ul className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
                    {logs.map((log) => (
                      <li key={log.id} className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
                        <div className="text-sm">{log.message}</div>
                        <div className="mt-0.5 text-xs text-[var(--muted)]">
                          {formatDateTime(log.createdAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm"
                  >
                    Закрыть
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
