import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-lg p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Мелкий капслок-заголовок карточки (.card-title из мокапов). */
export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-xs font-medium uppercase tracking-wider text-ink-faint mb-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
