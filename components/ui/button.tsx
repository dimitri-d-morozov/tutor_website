import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "amber" | "outline" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  amber: "bg-amber-600 text-white hover:bg-amber-500",
  outline: "border border-border text-ink hover:bg-surface-muted",
  ghost: "text-green-700 hover:bg-green-100",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

/** Кнопка-ссылка, если передан href, иначе обычная <button>. */
export function Button({
  variant = "amber",
  className,
  children,
  href,
  ...props
}: CommonProps &
  (
    | ({ href: string } & React.ComponentProps<typeof Link>)
    | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  )) {
  const classes = cn(base, variants[variant], className);

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        {...(props as Omit<React.ComponentProps<typeof Link>, "href">)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
