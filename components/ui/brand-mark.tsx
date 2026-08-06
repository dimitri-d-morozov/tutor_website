import { cn } from "@/lib/cn";

/** Логотип-шестиугольник: янтарная «клетка» с зелёной точкой внутри. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "hex flex h-8 w-8 items-center justify-center bg-amber-600",
        className,
      )}
    >
      <span className="hex block h-2.5 w-2.5 bg-green-900" />
    </div>
  );
}
