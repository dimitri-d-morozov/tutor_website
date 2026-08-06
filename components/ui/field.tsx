import { cn } from "@/lib/cn";

const controlClasses =
  "w-full rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-green-500 disabled:opacity-60";

/** Обёртка «подпись + контрол + подсказка/ошибка» (.field из мокапов). */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-ink-soft">
          {label}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-coral">{error}</span>
      ) : (
        hint && (
          <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
        )
      )}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlClasses, "resize-y", className)} {...props} />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, className)} {...props} />;
}

/**
 * Группа чекбоксов для полей-массивов (уровень: ОГЭ / ЕГЭ / Олимпиада).
 * Все чекбоксы под одним `name` — в FormData уезжают как несколько значений,
 * на сервере читаются через formData.getAll(name).
 */
export function CheckboxGroup({
  name,
  options,
  selected = [],
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  selected?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <label
          key={o.value}
          className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm has-checked:border-green-500 has-checked:bg-green-100"
        >
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={selected.includes(o.value)}
            className="accent-green-700"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
