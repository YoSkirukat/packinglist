"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HeaderAccount({
  login,
  role,
}: {
  login: string;
  role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium">{login}</div>
        <div className="text-[11px] text-[var(--muted)]">
          {role === "admin" ? "Администратор" : "Пользователь"}
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={loading}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface)] disabled:opacity-60"
      >
        {loading ? "Выход…" : "Выйти"}
      </button>
    </div>
  );
}
