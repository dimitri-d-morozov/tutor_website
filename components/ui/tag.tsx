import { cn } from "@/lib/cn";

type Tone = "green" | "amber" | "coral";

const tones: Record<Tone, string> = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-200 text-amber-600",
  coral: "bg-coral-100 text-coral",
};

/** Пилюля-бейдж (.tag из мокапов): статусы, типы, темы, результаты. */
export function Tag({
  tone = "green",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
