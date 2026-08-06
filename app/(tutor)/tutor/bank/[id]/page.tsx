import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import {
  EditQuestionButton,
  EditTestButton,
} from "@/components/tutor/test-detail-forms";
import { AddQuestionButton } from "@/components/tutor/question-create-form";
import { deleteQuestion, moveQuestion } from "../actions";
import { levelLabels, plural, questionTypeLabels } from "@/lib/labels";

type Option = { id: string; text: string };

/** Варианты ответа хранятся в JSONB — приводим к типу аккуратно. */
function parseOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (o): o is Option =>
      typeof o === "object" && o !== null && "id" in o && "text" in o,
  );
}

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("tutor");
  const { id } = await params;
  const supabase = await createClient();

  const { data: test } = await supabase
    .from("test_templates")
    .select("id, title, topic_id, section_id, levels, time_limit_min")
    .eq("id", id)
    .maybeSingle();

  if (!test) notFound();

  const [{ data: rows }, { data: topics }, { data: attempts }] =
    await Promise.all([
      supabase
        .from("test_template_questions")
        .select(
          "question_id, position, questions(id, text, type, options, correct_answer, explanation, max_points)",
        )
        .eq("test_template_id", id)
        .order("position"),
      supabase.from("topics").select("id, title, code").order("position"),
      supabase
        .from("student_test_attempts")
        .select("id, status, score, total, profiles:student_id(full_name)")
        .eq("test_template_id", id)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

  const questions = rows ?? [];
  const totalPoints = questions.reduce(
    (n, r) => n + r.questions.max_points,
    0,
  );
  const openCount = questions.filter((r) => r.questions.type === "open").length;
  const topicTitle = test.topic_id
    ? (topics ?? []).find((t) => t.id === test.topic_id)?.title
    : null;

  return (
    <div>
      <Link
        href="/tutor/bank"
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← К вопросам и тестам
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">{test.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {topicTitle ? <Tag>{topicTitle}</Tag> : <span>тема не указана</span>}
            {test.levels.map((l) => (
              <Tag key={l} tone="amber">
                {levelLabels[l]}
              </Tag>
            ))}
            <span>
              {questions.length}{" "}
              {plural(questions.length, "вопрос", "вопроса", "вопросов")} ·{" "}
              {totalPoints}{" "}
              {plural(totalPoints, "балл", "балла", "баллов")}
            </span>
            <span>
              {test.time_limit_min
                ? `· ${test.time_limit_min} мин`
                : "· без таймера"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <EditTestButton test={test} topics={topics ?? []} />
          <AddQuestionButton testId={test.id} />
        </div>
      </div>

      {openCount > 0 && (
        <Card className="mb-4 bg-surface-muted">
          <p className="text-sm text-ink-soft">
            В тесте {openCount}{" "}
            {plural(openCount, "развёрнутый вопрос", "развёрнутых вопроса", "развёрнутых вопросов")}
            . После сдачи попытка попадёт в{" "}
            <Link
              href="/tutor/review"
              className="font-medium text-green-700 hover:underline"
            >
              очередь проверки
            </Link>
            : там вы поставите баллы и напишете комментарий. Ученик сразу увидит
            результат по остальным вопросам.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {questions.map((row, i) => {
          const q = row.questions;
          const options = parseOptions(q.options);
          const correct = q.correct_answer;

          return (
            <Card key={q.id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-ink-faint">
                    Вопрос {i + 1}
                  </span>
                  <Tag tone={q.type === "open" ? "coral" : "green"}>
                    {questionTypeLabels[q.type]}
                  </Tag>
                  <span className="text-xs text-ink-faint">
                    {q.max_points}{" "}
                    {plural(q.max_points, "балл", "балла", "баллов")}
                  </span>
                </div>

                <div className="flex flex-none items-center gap-0.5">
                  <form action={moveQuestion}>
                    <input type="hidden" name="test_id" value={test.id} />
                    <input type="hidden" name="question_id" value={q.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={i === 0}
                      className="px-2"
                    >
                      ↑
                    </Button>
                  </form>
                  <form action={moveQuestion}>
                    <input type="hidden" name="test_id" value={test.id} />
                    <input type="hidden" name="question_id" value={q.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={i === questions.length - 1}
                      className="px-2"
                    >
                      ↓
                    </Button>
                  </form>
                  <EditQuestionButton question={q} options={options} />
                  <form action={deleteQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <Button type="submit" variant="ghost" className="text-coral">
                      Удалить
                    </Button>
                  </form>
                </div>
              </div>

              <div className="mb-3 font-display text-lg">{q.text}</div>

              {q.type === "single_choice" ? (
                <ul className="flex flex-col gap-1.5">
                  {options.map((o) => {
                    const isCorrect = correct === o.id;
                    return (
                      <li
                        key={o.id}
                        className={
                          isCorrect
                            ? "rounded-sm bg-green-100 px-3 py-2 text-sm font-medium text-green-700"
                            : "px-3 py-2 text-sm text-ink-soft"
                        }
                      >
                        {o.id}. {o.text}
                        {isCorrect && " ✓"}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-sm bg-surface-muted px-3 py-2 text-sm">
                  <span className="text-ink-faint">Эталон для проверки: </span>
                  {typeof correct === "string" && correct.length > 0
                    ? correct
                    : "не задан"}
                </div>
              )}

              {q.explanation && (
                <p className="mt-3 text-xs text-ink-soft">
                  Пояснение (ученик видит в работе над ошибками): {q.explanation}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {(attempts ?? []).length > 0 && (
        <Card className="mt-6">
          <CardTitle>Последние попытки</CardTitle>
          {(attempts ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0"
            >
              <span>{a.profiles?.full_name ?? "Ученик"}</span>
              <div className="flex items-center gap-2">
                {a.status === "pending_review" && (
                  <Link
                    href="/tutor/review"
                    className="text-xs font-medium text-amber-600 hover:underline"
                  >
                    ждёт проверки
                  </Link>
                )}
                <Tag
                  tone={
                    a.score !== null && a.total
                      ? a.score / a.total >= 0.8
                        ? "green"
                        : a.score / a.total >= 0.5
                          ? "amber"
                          : "coral"
                      : "amber"
                  }
                >
                  {a.score !== null && a.total !== null
                    ? `${a.score}/${a.total}`
                    : "не завершён"}
                </Tag>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
