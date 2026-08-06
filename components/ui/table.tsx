import { cn } from "@/lib/cn";

/** Таблица из мокапов: капслок-заголовки, разделители строк, без внешней рамки. */
export function Table({
  head,
  children,
  className,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse", className)}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={i}
              className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-faint"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Row({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn("border-b border-border last:border-0", className)}>
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-3 align-top text-sm", className)}>
      {children}
    </td>
  );
}
