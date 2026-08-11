import { z } from "zod";

/**
 * Формат файла для загрузки теста. Описание для человека — docs/test-format.md.
 *
 * Замысел: репетитор просит Клода «сделай тест по генетике в таком формате»,
 * получает .json и грузит его через форму. Поэтому формат оптимизирован под
 * генерацию и чтение глазами, а не под внутреннее устройство БД:
 *   - options — просто массив строк, без придуманных id;
 *   - correct — номер варианта с 1 (людям и моделям привычнее, чем индекс с 0);
 *   - section/topic — по названию, а не по uuid.
 * Преобразование в формат БД (options c id, correct_answer как "a") — в toDbPayload.
 */

// `error` задаём везде, где поле может просто отсутствовать: иначе zod отдаёт
// собственный текст по-английски («expected string, received undefined»),
// а репетитору нужно понятное объяснение.
const levelSchema = z.enum(["oge", "ege", "olympiad"], {
  error: "допустимые значения — oge, ege, olympiad",
});

const questionTextSchema = z
  .string({ error: "у вопроса должно быть поле text с текстом" })
  .trim()
  .min(1, "текст вопроса не может быть пустым");

// Максимум баллов за вопрос. У вопросов с выбором почти всегда 1, у развёрнутых
// 2–3 — как во второй части ЕГЭ, где ответ бывает верен частично.
const pointsSchema = z
  .number()
  .int("баллы должны быть целым числом")
  .min(1, "минимум 1 балл")
  .max(10, "максимум 10 баллов")
  .optional();

const singleChoiceSchema = z.object({
  text: questionTextSchema,
  type: z.literal("single_choice"),
  points: pointsSchema,
  options: z
    .array(z.string().trim().min(1, "вариант ответа не может быть пустым"), {
      error: "нужно поле options со списком вариантов ответа",
    })
    .min(2, "нужно минимум 2 варианта ответа"),
  correct: z
    .number({ error: "нужно поле correct — номер верного варианта, считая с 1" })
    .int("номер варианта должен быть целым числом")
    .min(1, "нумерация вариантов начинается с 1"),
  explanation: z.string().trim().optional(),
});

const multipleChoiceSchema = z.object({
  text: questionTextSchema,
  type: z.literal("multiple_choice"),
  points: pointsSchema,
  options: z
    .array(z.string().trim().min(1, "вариант ответа не может быть пустым"), {
      error: "нужно поле options со списком вариантов ответа",
    })
    .min(2, "нужно минимум 2 варианта ответа"),
  correct: z
    .array(
      z
        .number({ error: "номер варианта должен быть число" })
        .int("номер варианта должен быть целым числом")
        .min(1, "нумерация вариантов начинается с 1"),
      { error: "для multiple_choice нужно поле correct — массив номеров верных вариантов ([1, 3])" }
    )
    .min(1, "нужно минимум один верный вариант"),
  explanation: z.string().trim().optional(),
});

const openSchema = z.object({
  text: questionTextSchema,
  type: z.literal("open"),
  points: pointsSchema,
  answer: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
});

const questionSchema = z
  .discriminatedUnion("type", [singleChoiceSchema, multipleChoiceSchema, openSchema], {
    error: 'поле type должно быть "single_choice", "multiple_choice" или "open"',
  })
  // correct должен указывать на существующий вариант — иначе у теста нет верного
  // ответа, и обнаружить это уже после сохранения было бы неприятно.
  // superRefine, а не refine: нужно подставить в текст ошибки сами числа.
  .superRefine((q, ctx) => {
    if (q.type === "single_choice" && q.correct > q.options.length) {
      ctx.addIssue({
        code: "custom",
        message: `correct = ${q.correct}, а вариантов всего ${q.options.length}`,
        path: ["correct"],
      });
    }
    if (q.type === "multiple_choice") {
      const invalid = (q.correct as number[]).filter((c) => c < 1 || c > q.options.length);
      if (invalid.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `correct содержит невалидные номера: ${invalid.join(", ")} (вариантов всего ${q.options.length})`,
          path: ["correct"],
        });
      }
    }
  });

export const testFileSchema = z.object({
  title: z
    .string({ error: "укажите название теста в поле title" })
    .trim()
    .min(1, "укажите название теста"),
  // Необязательно: если не указан, отдел берётся из отдела темы. Так в файле
  // меньше полей и нельзя случайно указать отдел, противоречащий теме.
  section: z.string().trim().optional(),
  topic: z
    .string({ error: "тема у теста обязательна — укажите код или название в поле topic" })
    .trim()
    .min(1, "тема у теста обязательна"),
  levels: z
    .array(levelSchema, { error: "укажите уровни в поле levels, например [\"ege\"]" })
    .min(1, "укажите хотя бы один уровень"),
  time_limit_min: z
    .number()
    .int("лимит времени должен быть целым числом минут")
    .positive("лимит времени должен быть больше нуля")
    .optional(),
  questions: z
    .array(questionSchema, { error: "нужно поле questions со списком вопросов" })
    .min(1, "в тесте должен быть хотя бы один вопрос"),
});

export type TestFile = z.infer<typeof testFileSchema>;
export type TestQuestion = TestFile["questions"][number];

/** Буквенные id вариантов: a, b, c, … — как в формате questions.options. */
const OPTION_IDS = "abcdefghijklmnopqrstuvwxyz".split("");

/**
 * Разбор и валидация файла. Возвращает либо данные, либо список ошибок
 * по-русски — с указанием номера вопроса, чтобы было понятно, что править.
 */
export function parseTestFile(
  raw: string,
): { ok: true; data: TestFile } | { ok: false; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: [
        "Файл не является корректным JSON. Проверьте, что он сохранён целиком и без лишнего текста вокруг.",
      ],
    };
  }

  const result = testFileSchema.safeParse(json);
  if (result.success) return { ok: true, data: result.data };

  const errors = result.error.issues.map((issue) => {
    const path = issue.path;
    // Ошибка внутри вопроса → «Вопрос 3: …» вместо «questions.2.correct: …».
    if (path[0] === "questions" && typeof path[1] === "number") {
      const field = path.slice(2).join(".");
      const where = field ? ` (${field})` : "";
      return `Вопрос ${path[1] + 1}${where}: ${issue.message}`;
    }
    const field = path.join(".");
    return field ? `Поле «${field}»: ${issue.message}` : issue.message;
  });

  // Один и тот же промах модели часто даёт несколько одинаковых сообщений.
  return { ok: false, errors: [...new Set(errors)] };
}

/**
 * Перевод проверенного файла в payload для RPC import_test.
 * Отдел и тема уже разрешены в uuid вызывающей стороной.
 */
export function toDbPayload(
  file: TestFile,
  ids: { sectionId: string | null; topicId: string },
) {
  return {
    title: file.title,
    section_id: ids.sectionId,
    topic_id: ids.topicId,
    levels: file.levels,
    time_limit_min: file.time_limit_min ?? null,
    questions: file.questions.map((q) =>
      q.type === "single_choice"
        ? {
            text: q.text,
            type: "single_choice",
            max_points: q.points ?? 1,
            options: q.options.map((text, i) => ({
              id: OPTION_IDS[i],
              text,
            })),
            // correct — номер с 1, в БД храним id варианта.
            correct_answer: OPTION_IDS[q.correct - 1],
            explanation: q.explanation ?? null,
          }
        : q.type === "multiple_choice"
        ? {
            text: q.text,
            type: "multiple_choice",
            max_points: q.points ?? 1,
            options: q.options.map((text, i) => ({
              id: OPTION_IDS[i],
              text,
            })),
            // correct — массив номеров с 1, в БД храним массив letter id: ["a", "c"]
            correct_answer: (q.correct as number[]).map((i) => OPTION_IDS[i - 1]),
            explanation: q.explanation ?? null,
          }
        : {
            text: q.text,
            type: "open",
            max_points: q.points ?? 1,
            options: null,
            correct_answer: q.answer ?? null,
            explanation: q.explanation ?? null,
          },
    ),
  };
}

/** Буква варианта по его номеру — для превью. */
export function optionLetter(index: number): string {
  return OPTION_IDS[index] ?? "?";
}
