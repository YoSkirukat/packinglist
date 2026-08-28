"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, formatNumber } from "@/lib/format";

export function SettingsForm({
  initialUrl,
  lastSync,
  productsCount,
}: {
  initialUrl: string;
  lastSync: string | Date | null;
  productsCount: number;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => url.trim() !== initialUrl.trim(), [url, initialUrl]);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productsFileUrl: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setMessage("Ссылка сохранена");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/products-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productsFileUrl: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить товары");
      setMessage(
        `Загружено ${data.count} товаров: ${data.created} новых, ${data.updated} обновлённых`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <div className="text-sm font-medium">Ссылка на файл с товарами</div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Excel с колонками «Код товара», «Артикул», «Название». Подходят .xls и .xlsx.
        </p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">URL</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="field"
          placeholder="https://sc.rekova.ru/price/tovar.XLS"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button
          type="button"
          disabled={syncing || !url.trim()}
          onClick={() => void sync()}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-50"
        >
          {syncing ? "Загрузка…" : "Загрузить товары"}
        </button>
      </div>
      {message ? <p className="text-sm text-[#1a7f37]">{message}</p> : null}
      {error ? <p className="text-sm text-[#c62828]">{error}</p> : null}
      <div className="text-xs text-[var(--muted)]">
        В справочнике: {formatNumber(productsCount)} товаров
        {lastSync ? ` · обновлён ${formatDateTime(lastSync)}` : " · ещё не загружали"}
      </div>
    </form>
  );
}
