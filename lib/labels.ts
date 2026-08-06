import type { Database } from "@/types/database.types";

type Enums = Database["public"]["Enums"];

/**
 * Русские подписи для enum-ов БД. Держим в одном месте, чтобы «Презентация»
 * и «Домашнее задание» не расползлись по экранам с разными формулировками.
 */

export const materialTypeLabels: Record<Enums["material_type"], string> = {
  presentation: "Презентация",
  textbook: "Учебник",
  video: "Видео",
  homework: "Домашнее задание",
  other: "Другое",
};

/**
 * exam_type выступает в двух ролях: у ученика это экзамен, к которому он готовится,
 * у контента — уровень, которому материал соответствует. Отсюда два словаря.
 */
export const levelLabels: Record<Enums["exam_type"], string> = {
  oge: "ОГЭ",
  ege: "ЕГЭ",
  olympiad: "Олимпиада",
};

export const examTypeLabels: Record<Enums["exam_type"], string> = {
  oge: "ОГЭ",
  ege: "ЕГЭ",
  olympiad: "Олимпиада",
};

export const lessonMaterialRoleLabels: Record<
  Enums["lesson_material_role"],
  string
> = {
  presentation: "Презентация",
  extra: "Доп. материалы",
};

export const lessonStatusLabels: Record<Enums["lesson_status"], string> = {
  upcoming: "Предстоит",
  completed: "Пройдено",
};

export const questionTypeLabels: Record<Enums["question_type"], string> = {
  single_choice: "Один ответ",
  open: "Развёрнутый",
};

export const materialTypeOptions = Object.entries(materialTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

export const levelOptions = Object.entries(levelLabels).map(
  ([value, label]) => ({ value, label }),
);

/** «1 занятие / 2 занятия / 5 занятий» — правильная форма русского слова. */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/** Дата в формате «31 июля 2026», без времени. */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Дата со временем: «31 июля, 16:00». */
export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
