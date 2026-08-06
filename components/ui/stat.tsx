import { cn } from "@/lib/cn";

/** KPI-плитка (.stat из мокапов): крупное серифное число + подпись. */
export function Stat({
  num,
  label,
  className,
}: {
  num: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="font-display text-3xl leading-none text-ink">{num}</div>
      <div className="text-xs uppercase tracking-wider text-ink-faint">
        {label}
      </div>
    </div>
  );
}
