import { cn } from "@/lib/cn";

/** Полоса прогресса (.bar-track / .bar-fill из мокапов). value — проценты 0–100. */
export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-muted",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-green-500"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
