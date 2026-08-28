"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";

export function PackingListUpload({
  shipmentId,
  hasItems,
}: {
  shipmentId: string;
  hasItems: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function upload(file: File) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/packing-list`, {
        method: "POST",
        headers: {
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить файл");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setError("Нужен файл Excel: .xlsx или .xls");
      return;
    }
    if (hasItems && !window.confirm("Текущая таблица будет заменена новым packing list. Продолжить?")) {
      return;
    }
    void upload(file);
  }

  return (
    <div className="relative">
      {loading || isPending ? (
        <LoadingOverlay
          compact
          label={loading ? "Загружаем и разбираем файл..." : "Обновляем таблицу..."}
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragOver
            ? "border-[#e6d000] bg-[#fffbe6]"
            : "border-[var(--border)] bg-[var(--surface)]"
        }`}
      >
        <div className="text-sm font-medium">
          {hasItems ? "Заменить packing list" : "Загрузите packing list"}
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Excel-файл от поставщика: коробки, модели, количество, вес и объём
        </p>
        <button
          type="button"
          disabled={loading || isPending}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:brightness-95 disabled:opacity-60"
        >
          {loading || isPending ? "Обработка…" : hasItems ? "Выбрать другой файл" : "Выбрать Excel"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-[#c62828]">{error}</p> : null}
    </div>
  );
}
