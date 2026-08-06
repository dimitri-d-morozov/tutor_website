"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Все действия прохождения — тонкие обёртки над RPC.
 *
 * Начисление баллов и сверка с верным ответом живут в БД намеренно: иначе
 * `correct_answer` пришлось бы читать в приложении, а значит он мог бы утечь
 * в браузер. Здесь только маршрутизация и revalidate.
 */

/** Начать (или продолжить) попытку и уйти на страницу прохождения. */
export async function startTest(formData: FormData): Promise<void> {
  await requireRole("student");

  const testId = String(formData.get("test_id") ?? "");
  if (!testId) return;

  const lessonId = String(formData.get("student_lesson_id") ?? "").trim();
  const supabase = await createClient();

  const { data: attemptId, error } = await supabase.rpc("start_attempt", {
    p_test: testId,
    p_student_lesson: lessonId === "" ? undefined : lessonId,
  });

  if (error) throw new Error(error.message);

  redirect(`/student/tests/${attemptId}`);
}

/** Сохранить ответ на вопрос. Балл за выбор начисляется внутри RPC. */
export async function saveAnswer(formData: FormData): Promise<void> {
  await requireRole("student");

  const attemptId = String(formData.get("attempt_id") ?? "");
  const questionId = String(formData.get("question_id") ?? "");
  const answer = String(formData.get("answer") ?? "");
  if (!attemptId || !questionId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_answer", {
    p_attempt: attemptId,
    p_question: questionId,
    // given_answer — JSONB: id варианта («a») либо текст развёрнутого ответа.
    p_answer: answer,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/student/tests/${attemptId}`);
}

/**
 * Сдать тест и уйти на результат.
 *
 * Принимает ещё и последний ответ (`question_id` + `answer`), чтобы сохранить его
 * перед сдачей. Раньше это делалось в браузере: обработчик формы отменял отправку,
 * сохранял ответ и вызывал requestSubmit() — который снова запускал тот же
 * обработчик, и получалась бесконечная рекурсия. Здесь одно действие делает оба
 * шага, поэтому форма отправляется обычным способом и работает даже без JS.
 */
export async function finishTest(formData: FormData): Promise<void> {
  await requireRole("student");

  const attemptId = String(formData.get("attempt_id") ?? "");
  if (!attemptId) return;

  const supabase = await createClient();

  const questionId = String(formData.get("question_id") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();

  if (questionId !== "" && answer !== "") {
    const { error: saveError } = await supabase.rpc("save_answer", {
      p_attempt: attemptId,
      p_question: questionId,
      p_answer: answer,
    });
    // Ответ не сохранился — сдавать нельзя, иначе он потеряется молча.
    if (saveError) throw new Error(saveError.message);
  }

  const { error } = await supabase.rpc("finish_attempt", {
    p_attempt: attemptId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/student/tests");
  redirect(`/student/tests/${attemptId}/result`);
}
