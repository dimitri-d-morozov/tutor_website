"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Модальное окно из мокапов (.modal-overlay / .modal).
 *
 * Построено на нативном <dialog>: бесплатно даёт фокус-трап, закрытие по Escape
 * и корректную роль для скринридеров — писать это руками не нужно.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Escape и клик по подложке закрывают окно — событие close ловим здесь,
      // чтобы состояние в React не расходилось с состоянием <dialog>.
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[460px] max-w-[90vw] rounded-lg bg-surface p-7 text-ink",
        "backdrop:bg-green-900/45",
        className,
      )}
    >
      {/* Внутренний div: клик по содержимому не должен закрывать окно. */}
      <div onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 font-display text-xl">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}

/** Подвал модалки: кнопки, выровненные по правому краю. */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2.5">{children}</div>;
}
