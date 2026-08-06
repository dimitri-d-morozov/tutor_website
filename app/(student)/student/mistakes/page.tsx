import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { plural } from "@/lib/labels";

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
 * Работа над ошибками: вопросы, где ученик набрал не полный балл.
 *
 * Берём из attempt_questions — там уже нет верных ответов, а есть балл,
 * пояснение и комментарий репетитора. Ответы, ещё ожидающие проверки, в ошибки
 * не попадают: пока балл не выставлен, называть ответ ошибкой рано.
 */
export default async function MistakesPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();

  const [{ data: rows }, { data: attempts }, { data: topics }] =
    await Promise.all([
      supabase
        .from("attempt_questions")
        .select(
          "attempt_id, question_id, text, type, options, explanation, max_points, given_answer, points, is_correct, tutor_comment, topic_id",
        )
        .eq("student_id", profile.id),
      supabase
        .from("student_test_attempts")
        .select("id, test_template_id, finished_at, test_templates(title)")
        .eq("student_id", profile.id),
      supabase.from("topics").select("id, title"),
    ]);

  const attemptById = new Map((attempts ?? []).map((a) => [a.id, a]));
  const topicTitles = new Map((topics ?? []).map((t) => [t.id, t.title]));

  const answers = rows ?? [];

  // Не полный балл и проверено. Один и тот же вопрос мог быть завален
  // несколько раз — оставляем самую свежую попытку.
  const latest = new Map<string, (typeof answers)[number]>();
  for (const r of answers) {
    if (r.points === null) continue;
    if (r.points >= (r.max_points ?? 1)) continue;
    if (!r.question_id) continue;

    const prev = latest.get(r.question_id);
    const prevDate = prev?.attempt_id
      ? attemptById.get(prev.attempt_id)?.finished_at
      : null;
    const thisDate = r.attempt_id
      ? attemptById.get(r.attempt_id)?.finished_at
      : null;

    if (!prev || (thisDate ?? "") > (prevDate ?? "")) {
      latest.set(r.question_id, r);
    }
  }

  const mistakes = [...latest.values()];

  // Группируем по темам: разбирать ошибки удобнее темой целиком, а не вперемешку.
  const byTopic = new Map<string, { title: string; items: typeof mistakes }>();
  for (const m of mistakes) {
    const key = m.topic_id ?? "none";
    const entry = byTopic.get(key) ?? {
      title: m.topic_id
        ? topicTitles.get(m.topic_id) ?? "Без темы"
        : "Без темы",
      items: [],
    };
    entry.items.push(m);
    byTopic.set(key, entry);
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl">Работа над ошибками</h1>
      <p className="mb-6 text-sm text-ink-soft">
        {mistakes.length === 0
          ? "Здесь собираются вопросы, за которые вы получили не полный балл"
          : `${mistakes.length} ${plural(mistakes.length, "вопрос", "вопроса", "вопросов")} для повторения`}
      </p>

      {mistakes.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Ошибок нет"
            note="Пройдите тест — вопросы, где балл окажется не полным, появятся здесь вместе с пояснениями."
            action={<Button href="/student/tests">Перейти к тестам</Button>}
          />
        </Card>
      ) : (
        [...byTopic.entries()].map(([topicKey, group]) => (
        <div key={topicKey} className="mb-8">
          <CardTitle>
            {group.title}
            <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
              {group.items.length}{" "}
              {plural(group.items.length, "ошибка", "ошибки", "ошибок")}
            </span>
          </CardTitle>
          <div className="flex flex-col gap-3">
          {group.items.map((m) => {
            const attempt = m.attempt_id ? attemptById.get(m.attempt_id) : null;
            const options = parseOptions(m.options);
            const given = asText(m.given_answer);

            return (
              <Card
                key={m.question_id}
                className="border-l-[3px] border-l-coral"
              >
                {/* Тему в бейдже не дублируем — она в заголовке группы. */}
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink-faint">
                    {m.points} из {m.max_points}{" "}
                    {plural(m.max_points ?? 1, "балла", "баллов", "баллов")}
                  </span>
                  {attempt?.test_templates?.title && (
                    <span className="text-ink-faint">
                      · {attempt.test_templates.title}
                    </span>
                  )}
                </div>

                <div className="mb-3 font-display text-lg">{m.text}</div>

                {m.type === "single_choice" ? (
                  <ul className="flex flex-col gap-1">
                    {options.map((o) => (
                      <li
                        key={o.id}
                        className={
                          given === o.id
                            ? "rounded-sm bg-coral-100 px-3 py-1.5 text-sm text-coral"
                            : "px-3 py-1.5 text-sm text-ink-soft"
                        }
                      >
                        {o.text}
                        {given === o.id && " — ваш ответ"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-sm bg-surface-muted px-3 py-2 text-sm">
                    <span className="text-ink-faint">Ваш ответ: </span>
                    {given || "без ответа"}
                  </div>
                )}

                {m.tutor_comment && (
                  <div className="mt-3 rounded-sm border-l-2 border-amber-500 bg-surface px-3 py-2 text-sm">
                    <span className="text-ink-faint">
                      Комментарий репетитора:{" "}
                    </span>
                    {m.tutor_comment}
                  </div>
                )}

                {m.explanation && (
                  <p className="mt-3 rounded-sm bg-green-100 px-3 py-2 text-sm text-green-700">
                    {m.explanation}
                  </p>
                )}

                {attempt?.test_template_id && (
                  <div className="mt-3">
                    <Link
                      href="/student/tests"
                      className="text-[13px] font-medium text-green-700 hover:underline"
                    >
                      Пройти тест заново →
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
          </div>
        </div>
        ))
      )}
    </div>
  );
}
