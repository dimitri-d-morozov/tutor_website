"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/** Человекочитаемый размер файла. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Выбор файла с показом имени/размера и проверкой лимита на месте.
 *
 * Проверка в браузере — для удобства (сразу видно, что файл слишком большой,
 * не дожидаясь загрузки 60 МБ). Настоящая проверка всё равно на сервере:
 * клиентской доверять нельзя.
 */
export function FileInput({
  name,
  accept,
  maxSize,
  required,
}: {
  name: string;
  accept?: string;
  maxSize: number;
  required?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const tooBig = file !== null && file.size > maxSize;

  return (
    <div>
      <label
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 rounded-sm border border-dashed px-3 py-3 text-sm",
          tooBig ? "border-coral bg-coral-100" : "border-border hover:bg-surface-muted",
        )}
      >
        <span className={tooBig ? "text-coral" : "text-ink-soft"}>
          {file ? file.name : "Выберите файл…"}
        </span>
        <span className="shrink-0 text-xs text-ink-faint">
          {file ? formatFileSize(file.size) : `до ${formatFileSize(maxSize)}`}
        </span>
        <input
          type="file"
          name={name}
          accept={accept}
          required={required}
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {tooBig && (
        <span className="mt-1 block text-xs text-coral">
          Файл больше {formatFileSize(maxSize)} — загрузите файл меньшего размера
          или добавьте его ссылкой.
        </span>
      )}
    </div>
  );
}
