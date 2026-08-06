"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  optionLetter,
  parseTestFile,
  toDbPayload,
  type TestFile,
} from "@/lib/tests/format";

export type ImportState = {
  errors: string[];
  /** Разобранный файл — показываем в превью до сохранения. */
  preview?: {
    raw: string;
    file: TestFile;
    sectionTitle: string | null;
    topicTitle: string;
  };
};

/**
 * Разрешает названия отдела и темы из файла в uuid.
 *
 * Тема ищется и по коду («3.1»), и по названию — репетитору не нужно помнить,
 * что именно писать. Если не нашли, возвращаем ошибку, а не молчаливый null:
 * тест без темы не попадёт ни в один фильтр и потеряется в банке.
 */
async function resolveRefs(
  file: TestFile,
): Promise<
  | { ok: true; sectionId: string | null; sectionTitle: string | null; topicId: string; topicTitle: string }
  | { ok: false; errors: string[] }
> {
  const supabase = await createClient();
  const errors: string[] = [];

  let sectionId: string | null = null;
  let sectionTitle: string | null = null;
  if (file.section) {
    const { data } = await supabase
      .from("sections")
      .select("id, title")
      .ilike("title", file.section)
      .maybeSingle();
    if (!data) {
      errors.push(
        `Отдел «${file.section}» не найден. Список отделов — в разделе «Материалы → Отделы».`,
      );
    } else {
      sectionId = data.id;
      sectionTitle = data.title;
    }
  }

  const { data: byCode } = await supabase
    .from("topics")
    .select("id, title, section_id")
    .ilike("code", file.topic)
    .maybeSingle();

  let topic = byCode;
  if (!topic) {
    const { data: byTitle } = await supabase
      .from("topics")
      .select("id, title, section_id")
      .ilike("title", file.topic)
      .maybeSingle();
    topic = byTitle;
  }

  if (!topic) {
    errors.push(
      `Тема «${file.topic}» не найдена — укажите код (например, 3.1) или точное название темы из кодификатора.`,
    );
  }

  if (errors.length > 0 || !topic) return { ok: false, errors };

  // Отдел в файле не указан — берём отдел темы: тема уже лежит в своём отделе,
  // дублировать это в каждом файле теста незачем.
  if (!sectionId && topic.section_id) {
    sectionId = topic.section_id;
    const { data: s } = await supabase
      .from("sections")
      .select("title")
      .eq("id", topic.section_id)
      .maybeSingle();
    sectionTitle = s?.title ?? null;
  }

  return {
    ok: true,
    sectionId,
    sectionTitle,
    topicId: topic.id,
    topicTitle: topic.title,
  };
}

/** Шаг 1: разобрать файл и показать превью. В БД ничего не пишем. */
export async function analyzeTest(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireRole("tutor");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { errors: ["Выберите файл с тестом"] };
  }

  const raw = await file.text();
  const parsed = parseTestFile(raw);
  if (!parsed.ok) return { errors: parsed.errors };

  const refs = await resolveRefs(parsed.data);
  if (!refs.ok) return { errors: refs.errors };

  return {
    errors: [],
    preview: {
      raw,
      file: parsed.data,
      sectionTitle: refs.sectionTitle,
      topicTitle: refs.topicTitle,
    },
  };
}

/**
 * Шаг 2: сохранить тест в банк.
 *
 * Файл приезжает тем же текстом, что был в превью (скрытое поле), и валидируется
 * ЗАНОВО: скрытому полю доверять нельзя. Запись идёт через RPC import_test —
 * тест, вопросы и их связка создаются одной транзакцией, чтобы при сбое
 * не осталось половины теста.
 */
export async function saveTest(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireRole("tutor");

  const raw = String(formData.get("raw") ?? "");
  const parsed = parseTestFile(raw);
  if (!parsed.ok) return { errors: parsed.errors };

  const refs = await resolveRefs(parsed.data);
  if (!refs.ok) return { errors: refs.errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("import_test", {
    payload: toDbPayload(parsed.data, {
      sectionId: refs.sectionId,
      topicId: refs.topicId,
    }),
  });

  if (error) {
    return { errors: [`Не удалось сохранить тест: ${error.message}`] };
  }

  revalidatePath("/tutor/bank");
  redirect("/tutor/bank");
}

/**
 * Удалить тест вместе с его вопросами.
 *
 * Раньше вопросы оставались «в банке», но отдельного банка больше нет: вопросы
 * видны только внутри теста. Осиротевший вопрос стал бы невидимым мусором,
 * который никак не убрать из интерфейса.
 *
 * Вопросы, попавшие ещё и в другой тест, не трогаем — их удаление сломало бы
 * тот тест (связь many-to-many это допускает).
 */
export async function deleteTest(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();

  const [{ data: mine }, { data: elsewhere }] = await Promise.all([
    supabase
      .from("test_template_questions")
      .select("question_id")
      .eq("test_template_id", id),
    supabase
      .from("test_template_questions")
      .select("question_id")
      .neq("test_template_id", id),
  ]);

  const usedElsewhere = new Set((elsewhere ?? []).map((r) => r.question_id));
  const orphans = (mine ?? [])
    .map((r) => r.question_id)
    .filter((qid) => !usedElsewhere.has(qid));

  const { error } = await supabase.from("test_templates").delete().eq("id", id);
  if (error) throw new Error(`Не удалось удалить тест: ${error.message}`);

  // Только после успешного удаления теста: связка ушла по cascade, и вопросы
  // теперь действительно ни к чему не привязаны.
  if (orphans.length > 0) {
    await supabase.from("questions").delete().in("id", orphans);
  }

  revalidatePath("/tutor/bank");
}

/** Удалить вопрос из теста (и из базы — вне тестов вопросы не живут). */
export async function deleteQuestion(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw new Error(`Не удалось удалить вопрос: ${error.message}`);

  revalidatePath("/tutor/bank");
}

function optional(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/** Название, тема и лимит времени теста. */
export async function updateTest(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  const title = optional(formData.get("title"));
  if (!id || !title) return;

  const limit = optional(formData.get("time_limit_min"));
  const supabase = await createClient();

  const { error } = await supabase
    .from("test_templates")
    .update({
      title,
      topic_id: optional(formData.get("topic_id")),
      time_limit_min: limit ? Number(limit) : null,
    })
    .eq("id", id);

  if (error) throw new Error(`Не удалось изменить тест: ${error.message}`);
  revalidatePath(`/tutor/bank/${id}`);
  revalidatePath("/tutor/bank");
}

/**
 * Правка вопроса: текст, баллы, пояснение, верный ответ.
 *
 * Состав вариантов не меняем — их правка означала бы пересборку `options` и
 * сверку с уже сохранёнными ответами учеников. Нужно переписать варианты —
 * проще удалить вопрос и загрузить тест заново.
 */
export async function updateQuestion(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  const text = optional(formData.get("text"));
  if (!id || !text) return;

  const supabase = await createClient();
  const points = Number(formData.get("max_points") ?? 1);
  const correct = optional(formData.get("correct_answer"));

  const { error } = await supabase
    .from("questions")
    .update({
      text,
      max_points: Number.isFinite(points)
        ? Math.min(Math.max(points, 1), 10)
        : 1,
      explanation: optional(formData.get("explanation")),
      // correct_answer — JSONB: id варианта («a») либо эталонный текст.
      correct_answer: correct,
    })
    .eq("id", id);

  if (error) throw new Error(`Не удалось изменить вопрос: ${error.message}`);
  revalidatePath("/tutor/bank");
}

/**
 * Создать вопрос и дописать его в конец теста.
 *
 * Тему, отдел и уровни вопрос наследует ОТ ТЕСТА — так же, как при импорте файла
 * (`import_test`). Иначе созданный руками вопрос выпал бы из фильтров банка.
 *
 * Формат тот же, что у импорта: `options` = [{id:"a",text:"…"}],
 * `correct_answer` = id варианта либо эталонный текст для развёрнутого.
 */
export type QuestionFormState = { error: string | null; ok?: boolean };

export async function createQuestion(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  await requireRole("tutor");

  const testId = optional(formData.get("test_id"));
  const text = optional(formData.get("text"));
  if (!testId) return { error: "Не передан тест" };
  if (!text) return { error: "Укажите текст вопроса" };

  const type = String(formData.get("type") ?? "single_choice") as
    | "single_choice"
    | "open";
  const points = Number(formData.get("max_points") ?? 1);
  const maxPoints = Number.isFinite(points)
    ? Math.min(Math.max(points, 1), 10)
    : 1;

  const supabase = await createClient();

  const { data: test } = await supabase
    .from("test_templates")
    .select("topic_id, section_id, levels")
    .eq("id", testId)
    .maybeSingle();

  if (!test) return { error: "Тест не найден" };

  let options: Array<{ id: string; text: string }> | null = null;
  let correctAnswer: string | null = null;

  if (type === "single_choice") {
    // Пустые строки отбрасываем: репетитор мог добавить лишние поля вариантов.
    const texts = formData
      .getAll("option")
      .map((v) => String(v).trim())
      .filter((v) => v !== "");

    if (texts.length < 2) {
      return { error: "Нужно минимум два варианта ответа" };
    }

    options = texts.map((t, i) => ({ id: optionLetter(i), text: t }));

    const correctIndex = Number(formData.get("correct_index") ?? 0);
    if (
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= texts.length
    ) {
      return { error: "Отметьте, какой вариант верный" };
    }
    correctAnswer = optionLetter(correctIndex);
  } else {
    correctAnswer = optional(formData.get("correct_answer"));
  }

  const { data: created, error } = await supabase
    .from("questions")
    .insert({
      text,
      type,
      max_points: maxPoints,
      options,
      correct_answer: correctAnswer,
      explanation: optional(formData.get("explanation")),
      topic_id: test.topic_id,
      section_id: test.section_id,
      levels: test.levels,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: `Не удалось создать вопрос: ${error?.message ?? ""}` };
  }

  const { data: last } = await supabase
    .from("test_template_questions")
    .select("position")
    .eq("test_template_id", testId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: linkError } = await supabase
    .from("test_template_questions")
    .insert({
      test_template_id: testId,
      question_id: created.id,
      position: (last?.position ?? 0) + 1,
    });

  if (linkError) {
    // Вопрос, не привязанный к тесту, нигде не показывается — откатываем.
    await supabase.from("questions").delete().eq("id", created.id);
    return { error: `Не удалось добавить вопрос в тест: ${linkError.message}` };
  }

  revalidatePath(`/tutor/bank/${testId}`);
  revalidatePath("/tutor/bank");
  return { error: null, ok: true };
}

/** Поменять вопрос местами с соседним внутри теста. */
export async function moveQuestion(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const testId = optional(formData.get("test_id"));
  const questionId = optional(formData.get("question_id"));
  const direction = String(formData.get("direction") ?? "");
  if (!testId || !questionId) return;
  if (direction !== "up" && direction !== "down") return;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("test_template_questions")
    .select("question_id, position")
    .eq("test_template_id", testId)
    .order("position");

  if (!rows) return;
  const index = rows.findIndex((r) => r.question_id === questionId);
  const neighbour = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighbour < 0 || neighbour >= rows.length) return;

  await Promise.all([
    supabase
      .from("test_template_questions")
      .update({ position: rows[neighbour].position })
      .eq("test_template_id", testId)
      .eq("question_id", rows[index].question_id),
    supabase
      .from("test_template_questions")
      .update({ position: rows[index].position })
      .eq("test_template_id", testId)
      .eq("question_id", rows[neighbour].question_id),
  ]);

  revalidatePath(`/tutor/bank/${testId}`);
}
