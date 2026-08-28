"use client";

export function LoadingOverlay({
  label = "Обработка...",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/75 backdrop-blur-[1px]"
          : "fixed inset-0 z-[1200] flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
      }
    >
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-lg">
        <div className="nav-spinner h-4 w-4 rounded-full border-2 border-[var(--border)] border-t-[var(--link)]" />
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
      </div>
    </div>
  );
}
