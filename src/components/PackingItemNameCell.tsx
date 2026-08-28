"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapProductButton } from "@/components/MapProductButton";
import { LoadingOverlay } from "@/components/LoadingOverlay";

export function PackingItemNameCell({
  shipmentId,
  itemId,
  supplierName,
  mappedName,
  mappedCode,
  mappedArticle,
}: {
  shipmentId: string;
  itemId: string;
  supplierName: string;
  mappedName: string;
  mappedCode: string;
  mappedArticle: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(supplierName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshLabel, setRefreshLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setDraft(supplierName);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(supplierName);
    setError(null);
    setEditing(false);
  }

  async function save() {
    const next = draft.replace(/\s+/g, " ").trim();
    if (!next) {
      setError("Название не может быть пустым");
      return;
    }
    if (next === supplierName) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierName: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить");
      setEditing(false);
      setRefreshLabel("Сохраняем название...");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Удалить строку «${supplierName}»?\n\nЭто действие нельзя отменить.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось удалить");
      setRefreshLabel("Удаляем строку...");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative">
      {saving || deleting || isPending ? (
        <LoadingOverlay
          compact
          label={
            saving
              ? "Сохраняем название..."
              : deleting
                ? "Удаляем строку..."
                : refreshLabel || "Обновляем таблицу..."
          }
        />
      ) : null}
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="field text-sm"
          autoFocus
        />
      ) : mappedName ? (
        <div>
          <div className="font-medium">{mappedName}</div>
          {mappedCode ? (
            <div className="mt-0.5 text-xs text-[var(--muted)]">
              Код товара: {mappedCode}
            </div>
          ) : null}
          {mappedArticle ? (
            <div className="text-xs text-[var(--muted)]">Артикул: {mappedArticle}</div>
          ) : null}
          <div className="text-xs text-[var(--muted)]">
            Китайское название: {supplierName}
          </div>
        </div>
      ) : (
        <div className="font-medium">{supplierName}</div>
      )}

      {error ? <p className="mt-1 text-xs text-[#c62828]">{error}</p> : null}

      <div className="mt-1 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || deleting || isPending}
              className="rounded-md bg-[var(--brand)] px-2 py-0.5 text-xs font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
            >
              {saving || isPending ? "Сохранение…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving || deleting || isPending}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface)] disabled:opacity-60"
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <MapProductButton
              shipmentId={shipmentId}
              itemId={itemId}
              supplierName={supplierName}
              mappedName={mappedName}
            />
            <button
              type="button"
              onClick={startEdit}
              disabled={saving || deleting || isPending}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs font-medium hover:bg-[var(--surface)] disabled:opacity-60"
            >
              Изменить название
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving || deleting || isPending}
              className="rounded-md border border-[#f5c2c2] px-2 py-0.5 text-xs font-medium text-[#c62828] hover:bg-[#fdeceb] disabled:opacity-60"
            >
              {deleting || isPending ? "Удаление…" : "Удалить"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
