/** Мини-хелпер для условной склейки классов (без внешних зависимостей). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
