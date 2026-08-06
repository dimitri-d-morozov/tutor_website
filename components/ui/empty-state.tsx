/** Заглушка пустого раздела: «ещё ничего не добавлено». */
export function EmptyState({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="hex mb-1 h-6 w-6 bg-surface-muted" />
      <div className="font-display text-lg">{title}</div>
      {note && <p className="max-w-sm text-sm text-ink-soft">{note}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
