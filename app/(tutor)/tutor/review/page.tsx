import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewForm } from "@/components/tutor/review-form";
import { formatDateTime, plural } from "@/lib/labels";

/**
 * Очередь проверки развёрнутых ответов.
 *
 * Сюда попадают попытки в статусе `pending_review` — то есть те, где ученик
 * ответил на развёрнутый вопрос, а балл ещё не выставлен. Как только последний
 * ответ проверен, RPC `review_answer` сама закрывает попытку, и она уходит из
 * очереди.
 */
export default async function ReviewPage() {
  await requireRole("tutor");
  const supabase = await createClient();

  const { data: attempts } = await supabase
    .from("student_test_attempts")
    .select(
      "id, started_at, finished_at, score, total, student_id, profiles:student_id(full_name), test_templates(id, title)",
    )
    .eq("status", "pending_review")
    .order("finished_at", { ascending: true });

  const list = attempts ?? [];

  // Развёрнутые ответы без балла — то, что собственно нужно проверить.
  // Читаем через attempt_questions: там же лежит и ответ ученика.
  const { data: answers } = await supabase
    .from("attempt_questions")
    .select(
      "attempt_id, position, question_id, text, explanation, max_points, answer_id, given_answer, points",
    )
    .in(
      "attempt_id",
      list.length > 0 ? list.map((a) => a.id) : ["00000000-0000-0000-0000-000000000000"],
    )
    .eq("type", "open")
    .order("position");

  // Эталонные ответы репетитору нужны — их отдаёт таблица questions (доступна
  // только ему), attempt_questions их намеренно не содержит.
  const questionIds = (answers ?? [])
    .map((a) => a.question_id)
    .filter((id): id is string => id !== null);

  const { data: references } = await supabase
    .from("questions")
    .select("id, correct_answer")
    .in(
      "id",
      questionIds.length > 0
        ? questionIds
        : ["00000000-0000-0000-0000-000000000000"],
    );

  const referenceById = new Map(
    (references ?? []).map((q) => [
      q.id,
      typeof q.correct_answer === "string" ? q.correct_answer : null,
    ]),
  );

  const pendingByAttempt = new Map<string, typeof answers>();
  for (const a of answers ?? []) {
    if (!a.attempt_id) continue;
    if (a.answer_id === null || a.points !== null) continue; // нечего проверять
    const acc = pendingByAttempt.get(a.attempt_id) ?? [];
    acc.push(a);
    pendingByAttempt.set(a.attempt_id, acc);
  }

  const totalPending = [...pendingByAttempt.values()].reduce(
    (n, arr) => n + (arr?.length ?? 0),
    0,
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl">Проверка ответов</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {list.length === 0
          ? "Развёрнутые ответы учеников появятся здесь после сдачи тестов"
          : `${totalPending} ${plural(totalPending, "ответ", "ответа", "ответов")} в ${list.length} ${plural(list.length, "попытке", "попытках", "попытках")}`}
      </p>

      {list.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Всё проверено"
            note="Когда ученик сдаст тест с развёрнутым вопросом, попытка появится здесь. Балл за вопросы с выбором начисляется автоматически."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((attempt) => {
            const pending = pendingByAttempt.get(attempt.id) ?? [];

            return (
              <Card key={attempt.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-xl">
                      {attempt.profiles?.full_name ?? "Ученик"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                      {attempt.test_templates && (
                        <Link
                          href={`/tutor/bank/${attempt.test_templates.id}`}
                          className="font-medium text-green-700 hover:underline"
                        >
                          {attempt.test_templates.title}
                        </Link>
                      )}
                      <span>сдан {formatDateTime(attempt.finished_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-faint">
                      автопроверка:
                    </span>
                    <Tag tone="amber">
                      {attempt.score ?? 0} из {attempt.total ?? 0}
                    </Tag>
                    <Link
                      href={`/tutor/students/${attempt.student_id}`}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      карточка ученика
                    </Link>
                  </div>
                </div>

                {pending.length === 0 ? (
                  <p className="text-sm text-ink-faint">
                    Непроверенных развёрнутых ответов нет — попытка закроется
                    после обновления страницы.
                  </p>
                ) : (
                  pending.map((a) => (
                    <div
                      key={a.answer_id}
                      className="border-t border-border pt-4 first:border-0 first:pt-0"
                    >
                      <CardTitle>Вопрос {a.position}</CardTitle>
                      <div className="mb-3 font-display text-lg">{a.text}</div>

                      <div className="mb-3 rounded-sm bg-surface-muted px-3 py-2 text-sm">
                        <span className="text-ink-faint">Эталон: </span>
                        {a.question_id
                          ? referenceById.get(a.question_id) ?? "не задан"
                          : "не задан"}
                      </div>

                      <div className="mb-3 rounded-sm border-l-2 border-green-500 bg-surface px-3 py-2 text-sm">
                        <span className="text-ink-faint">Ответ ученика: </span>
                        {typeof a.given_answer === "string"
                          ? a.given_answer
                          : JSON.stringify(a.given_answer)}
                      </div>

                      {a.explanation && (
                        <p className="mb-3 text-xs text-ink-soft">
                          Пояснение из теста: {a.explanation}
                        </p>
                      )}

                      <ReviewForm
                        answerId={a.answer_id!}
                        maxPoints={a.max_points ?? 1}
                      />
                    </div>
                  ))
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
