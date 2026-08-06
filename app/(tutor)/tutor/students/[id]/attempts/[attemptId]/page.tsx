import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ReviewForm } from "@/components/tutor/review-form";
import { formatDateTime, plural } from "@/lib/labels";
import { formatSpent, isOvertime } from "@/lib/tests/attempt";

type Option = { id: string; text: string };

function parseOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (o): o is Option =>
      typeof o === "object" && o !== null && "id" in o && "text" in o,
  );
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

/**
 * Разбор попытки ученика.
 *
 * Здесь же можно переставить балл и переписать комментарий — та же
 * `review_answer`, что и в очереди проверки. Пригодится, когда решение хочется
 * пересмотреть, а попытка уже закрыта.
 */
export default async function AttemptReviewPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  await requireRole("tutor");
  const { id, attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("student_test_attempts")
    .select(
      "id, student_id, status, score, total, started_at, finished_at, profiles:student_id(full_name), test_templates(id, title, time_limit_min, topics!test_templates_topic_id_fkey(title))",
    )
    .eq("id", attemptId)
    .eq("student_id", id)
    .maybeSingle();

  if (!attempt) notFound();

  const [{ data: rows }, { data: references }] = await Promise.all([
    supabase
      .from("attempt_questions")
      .select(
        "question_id, position, text, type, options, explanation, max_points, answer_id, given_answer, points, is_correct, tutor_comment",
      )
      .eq("attempt_id", attemptId)
      .order("position"),
    // Эталоны берём из questions: view их намеренно не содержит, а репетитору
    // они нужны для проверки.
    supabase.from("questions").select("id, correct_answer"),
  ]);

  const referenceById = new Map(
    (references ?? []).map((q) => [
      q.id,
      typeof q.correct_answer === "string" ? q.correct_answer : null,
    ]),
  );

  const questions = rows ?? [];
  const limit = attempt.test_templates?.time_limit_min ?? null;
  const overtime = isOvertime(attempt.started_at, attempt.finished_at, limit);
  const spent = formatSpent(attempt.started_at, attempt.finished_at, limit);

  const score = attempt.score ?? 0;
  const total = attempt.total ?? 0;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div>
      <Link
        href={`/tutor/students/${id}`}
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← К карточке ученика
      </Link>

      <div className="mb-6">
        <h1 className="mb-1 font-display text-3xl">
          {attempt.test_templates?.title ?? "Тест"}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span className="font-medium">
            {attempt.profiles?.full_name ?? "Ученик"}
          </span>
          {attempt.test_templates?.topics?.title && (
            <Tag>{attempt.test_templates.topics.title}</Tag>
          )}
          <span>{formatDateTime(attempt.finished_at)}</span>
          {spent && (
            <span className={overtime ? "font-medium text-coral" : undefined}>
              · {spent}
            </span>
          )}
          {attempt.status === "pending_review" && (
            <Tag tone="amber">ждёт проверки</Tag>
          )}
        </div>
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex items-end gap-3">
          <div className="font-display text-4xl font-bold text-green-700">
            {score}
          </div>
          <div className="pb-1 text-sm text-ink-soft">
            из {total} {plural(total, "балла", "баллов", "баллов")} · {percent}%
          </div>
        </div>
        <ProgressBar value={percent} />
        {overtime && (
          <p className="mt-3 rounded-sm bg-coral-100 px-3 py-2 text-sm text-coral">
            Ученик не уложился в лимит: {spent}. Ответы всё равно сохранены —
            лимит не блокирует прохождение.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const options = parseOptions(q.options);
          const given = asText(q.given_answer);
          const isOpen = q.type === "open";
          const awaiting = isOpen && q.points === null;
          const max = q.max_points ?? 1;
          const reference = q.question_id
            ? referenceById.get(q.question_id)
            : null;

          return (
            <Card key={q.question_id ?? i}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-ink-faint">
                  Вопрос {i + 1}
                </span>
                {awaiting ? (
                  <Tag tone="amber">не проверен</Tag>
                ) : (
                  <Tag
                    tone={
                      q.points === max
                        ? "green"
                        : (q.points ?? 0) > 0
                          ? "amber"
                          : "coral"
                    }
                  >
                    {q.points ?? 0} из {max}
                  </Tag>
                )}
              </div>

              <div className="mb-3 font-display text-lg">{q.text}</div>

              {isOpen ? (
                <>
                  <div className="mb-3 rounded-sm bg-surface-muted px-3 py-2 text-sm">
                    <span className="text-ink-faint">Эталон: </span>
                    {reference ?? "не задан"}
                  </div>
                  <div className="mb-3 rounded-sm border-l-2 border-green-500 bg-surface px-3 py-2 text-sm">
                    <span className="text-ink-faint">Ответ ученика: </span>
                    {given || (
                      <span className="text-ink-faint">без ответа</span>
                    )}
                  </div>

                  {q.tutor_comment && (
                    <div className="mb-3 rounded-sm border-l-2 border-amber-500 bg-surface px-3 py-2 text-sm">
                      <span className="text-ink-faint">Ваш комментарий: </span>
                      {q.tutor_comment}
                    </div>
                  )}

                  {q.answer_id ? (
                    <>
                      <CardTitle className="mt-4">
                        {awaiting ? "Проверить" : "Изменить оценку"}
                      </CardTitle>
                      <ReviewForm answerId={q.answer_id} maxPoints={max} />
                    </>
                  ) : (
                    <p className="text-xs text-ink-faint">
                      Ученик не ответил — проверять нечего, вопрос учтён с нулём
                      баллов.
                    </p>
                  )}
                </>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {options.map((o) => {
                    const chosen = given === o.id;
                    const isRight = reference === o.id;
                    return (
                      <li
                        key={o.id}
                        className={
                          isRight
                            ? "rounded-sm bg-green-100 px-3 py-2 text-sm font-medium text-green-700"
                            : chosen
                              ? "rounded-sm bg-coral-100 px-3 py-2 text-sm font-medium text-coral"
                              : "px-3 py-2 text-sm text-ink-soft"
                        }
                      >
                        {o.text}
                        {isRight && " — верный"}
                        {chosen && !isRight && " — выбрал ученик"}
                        {chosen && isRight && " ✓ выбрал ученик"}
                      </li>
                    );
                  })}
                  {given === "" && (
                    <li className="px-3 py-2 text-sm text-ink-faint">
                      Ученик не ответил
                    </li>
                  )}
                </ul>
              )}

              {q.explanation && (
                <p className="mt-3 text-xs text-ink-soft">
                  Пояснение: {q.explanation}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
