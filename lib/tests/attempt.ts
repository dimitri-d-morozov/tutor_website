/**
 * Вспомогательное про попытки тестов — общее для кабинета ученика и репетитора.
 */

/**
 * Уложился ли ученик в лимит времени.
 *
 * Считается из дат, а не хранится флагом: хранимое значение разошлось бы с
 * `started_at`/`finished_at` при любой их правке. Лимит с версии
 * 20260806000010 ничего не блокирует — превышение только фиксируется.
 */
export function isOvertime(
  startedAt: string | null,
  finishedAt: string | null,
  limitMinutes: number | null,
): boolean {
  if (!startedAt || !finishedAt || !limitMinutes) return false;
  const spentMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return spentMs > limitMinutes * 60_000;
}

/** Сколько минут ушло на попытку. */
export function spentMinutes(
  startedAt: string | null,
  finishedAt: string | null,
): number | null {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/** «12 мин» либо «22 мин, лимит 15» — подпись к попытке. */
export function formatSpent(
  startedAt: string | null,
  finishedAt: string | null,
  limitMinutes: number | null,
): string | null {
  const spent = spentMinutes(startedAt, finishedAt);
  if (spent === null) return null;
  if (isOvertime(startedAt, finishedAt, limitMinutes)) {
    return `${spent} мин, лимит ${limitMinutes}`;
  }
  return `${spent} мин`;
}
