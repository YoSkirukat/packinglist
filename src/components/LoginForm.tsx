"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось войти");
      const next = searchParams.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Логин</span>
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="field"
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="text-sm text-[#c62828]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
      >
        {loading ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
