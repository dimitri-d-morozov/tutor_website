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
 *
 * Считаем только последнюю завершённую попытку каждого теста: если тест
 * пройден заново, старые ошибки из более ранней попытки того же теста больше
 * не показываем — сохранённый счётчик неверных попыток разошёлся бы
 * с реальным прогрессом.
 */
export default async function MistakesPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();

  const [{ data: rows }, { data: attempts }, { data: sections }, { data: topics }] =
    await Promise.all([
      supabase
        .from("attempt_questions")
        .select(
          "attempt_id, question_id, text, type, options, explanation, max_points, given_answer, points, is_correct, tutor_comment, section_id, topic_id",
        )
        .eq("student_id", profile.id),
      supabase
        .from("student_test_attempts")
        .select("id, test_template_id, finished_at, test_templates(title)")
        .eq("student_id", profile.id)
        .not("finished_at", "is", null),
      supabase.from("sections").select("id, title").order("position"),
      supabase.from("topics").select("id, title"),
    ]);

  const attemptById = new Map((attempts ?? []).map((a) => [a.id, a]));
  const sectionTitles = new Map((sections ?? []).map((s) => [s.id, s.title]));
  const sectionOrder = (sections ?? []).map((s) => s.id);
  const topicTitles = new Map((topics ?? []).map((t) => [t.id, t.title]));

  const answers = rows ?? [];

  // Последняя завершённая попытка каждого теста.
  const latestAttemptByTest = new Map<string, NonNullable<typeof attempts>[number]>();
  for (const a of attempts ?? []) {
    if (!a.test_template_id) continue;
    const prev = latestAttemptByTest.get(a.test_template_id);
    if (!prev || (a.finished_at ?? "") > (prev.finished_at ?? "")) {
      latestAttemptByTest.set(a.test_template_id, a);
    }
  }

  // Не полный балл, проверено, и ответ — из последней попытки своего теста.
  const mistakes = answers.filter((r) => {
    if (r.points === null) return false;
    if (r.points >= (r.max_points ?? 1)) return false;
    const attempt = r.attempt_id ? attemptById.get(r.attempt_id) : null;
    if (!attempt?.test_template_id) return false;
    return latestAttemptByTest.get(attempt.test_template_id)?.id === r.attempt_id;
  });

  // Раздел → тема → тест — так удобнее разбирать ошибки блоками, а не вперемешку.
  const bySection = new Map<
    string,
    {
      title: string;
      topics: Map<
        string,
        {
          title: string;
          tests: Map<string, { title: string; items: typeof mistakes }>;
        }
      >;
    }
  >();
  for (const m of mistakes) {
    const attempt = m.attempt_id ? attemptById.get(m.attempt_id) : null;
    const testKey = attempt?.test_template_id ?? "none";
    const testTitle = attempt?.test_templates?.title ?? "Без теста";

    const sectionKey = m.section_id ?? "none";
    const section = bySection.get(sectionKey) ?? {
      title: m.section_id ? sectionTitles.get(m.section_id) ?? "Без раздела" : "Без раздела",
      topics: new Map(),
    };
    const topicKey = m.topic_id ?? "none";
    const topic = section.topics.get(topicKey) ?? {
      title: m.topic_id ? topicTitles.get(m.topic_id) ?? "Без темы" : "Без темы",
      tests: new Map(),
    };
    const test = topic.tests.get(testKey) ?? { title: testTitle, items: [] };

    test.items.push(m);
    topic.tests.set(testKey, test);
    section.topics.set(topicKey, topic);
    bySection.set(sectionKey, section);
  }

  const sectionKeys = [...bySection.keys()].sort((a, b) => {
    const ai = sectionOrder.indexOf(a);
    const bi = sectionOrder.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

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
        sectionKeys.map((sectionKey) => {
          const section = bySection.get(sectionKey)!;
          const topicKeys = [...section.topics.keys()].sort((a, b) =>
            section.topics.get(a)!.title.localeCompare(section.topics.get(b)!.title, "ru"),
          );

          return (
            <div key={sectionKey} className="mb-8">
              <h2 className="mb-3 font-display text-xl">{section.title}</h2>
              {topicKeys.map((topicKey) => {
                const topic = section.topics.get(topicKey)!;
                const testKeys = [...topic.tests.keys()].sort((a, b) =>
                  topic.tests.get(a)!.title.localeCompare(topic.tests.get(b)!.title, "ru"),
                );

                return (
                  <div key={topicKey} className="mb-5">
                    <CardTitle>{topic.title}</CardTitle>
                    {testKeys.map((testKey) => {
                      const test = topic.tests.get(testKey)!;
                      return (
                        <div key={testKey} className="mb-4 last:mb-0">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">
                            {test.title}{" "}
                            <span className="font-normal normal-case tracking-normal">
                              · {test.items.length}{" "}
                              {plural(test.items.length, "ошибка", "ошибки", "ошибок")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            {test.items.map((m) => {
                              const options = parseOptions(m.options);
                              const given = asText(m.given_answer);

                              return (
                                <Card
                                  key={m.question_id}
                                  className="border-l-[3px] border-l-coral"
                                >
                                  <div className="mb-2 text-xs text-ink-faint">
                                    {m.points} из {m.max_points}{" "}
                                    {plural(m.max_points ?? 1, "балла", "баллов", "баллов")}
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
                                  ) : m.type === "multiple_choice" ? (() => {
                                    let selectedIds: string[] = [];
                                    try {
                                      selectedIds = JSON.parse(given);
                                    } catch {
                                      selectedIds = [];
                                    }
                                    return (
                                      <ul className="flex flex-col gap-1">
                                        {options.map((o) => (
                                          <li
                                            key={o.id}
                                            className={
                                              selectedIds.includes(o.id)
                                                ? "rounded-sm bg-coral-100 px-3 py-1.5 text-sm text-coral"
                                                : "px-3 py-1.5 text-sm text-ink-soft"
                                            }
                                          >
                                            {o.text}
                                            {selectedIds.includes(o.id) && " — вы выбрали"}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  })() : (
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

                                  <div className="mt-3">
                                    <Link
                                      href="/student/tests"
                                      className="text-[13px] font-medium text-green-700 hover:underline"
                                    >
                                      Пройти тест заново →
                                    </Link>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
