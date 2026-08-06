import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { startTest } from "./actions";
import { formatDateTime, plural } from "@/lib/labels";
import { isOvertime } from "@/lib/tests/attempt";

/**
 * Тесты, доступные ученику: сгруппированы по темам, у каждого — история попыток.
 *
 * Доступность обеспечивает RLS: политика `tt_select` отдаёт только тесты по темам
 * пройденных занятий. Поэтому здесь просто читаем test_templates — фильтровать
 * руками не нужно, и обойти нельзя.
 */
export default async function StudentTestsPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();

  const [{ data: tests }, { data: attempts }, { data: homework }] =
    await Promise.all([
      supabase
        .from("test_templates")
        // topics через конкретный ключ: после появления topic_tests между
        // test_templates и topics стало две связи (см. CLAUDE.md).
        .select(
          "id, title, time_limit_min, topic_id, topics!test_templates_topic_id_fkey(title), test_template_questions(count)",
        )
        .order("title"),
      supabase
        .from("student_test_attempts")
        .select("id, test_template_id, status, score, total, started_at, finished_at")
        .eq("student_id", profile.id)
        .order("started_at", { ascending: false }),
      supabase
        .from("student_lesson_tests")
        .select("test_template_id, student_lesson_id"),
    ]);

  const all = tests ?? [];
  const homeworkTestIds = new Set(
    (homework ?? []).map((h) => h.test_template_id),
  );
  const lessonByTest = new Map(
    (homework ?? []).map((h) => [h.test_template_id, h.student_lesson_id]),
  );

  /** Попытки по тесту: завершённые (история) и незавершённая (продолжить). */
  const historyByTest = new Map<string, typeof attempts>();
  const inProgress = new Map<string, string>();

  for (const a of attempts ?? []) {
    if (!a.test_template_id) continue;
    if (a.status === "in_progress") {
      if (!inProgress.has(a.test_template_id)) {
        inProgress.set(a.test_template_id, a.id);
      }
      continue;
    }
    const acc = historyByTest.get(a.test_template_id) ?? [];
    acc.push(a);
    historyByTest.set(a.test_template_id, acc);
  }

  function bestOf(testId: string): string | null {
    const list = historyByTest.get(testId) ?? [];
    let best: { score: number; total: number } | null = null;
    for (const a of list) {
      if (a.score === null || a.total === null || a.total === 0) continue;
      if (!best || a.score / a.total > best.score / best.total) {
        best = { score: a.score, total: a.total };
      }
    }
    return best ? `${best.score}/${best.total}` : null;
  }

  /** Карточка теста с историей попыток. */
  const renderTest = (t: (typeof all)[number]) => {
    const count = t.test_template_questions[0]?.count ?? 0;
    const history = historyByTest.get(t.id) ?? [];
    const running = inProgress.get(t.id);
    const best = bestOf(t.id);
    const isHomework = homeworkTestIds.has(t.id);

    return (
      <Card key={t.id}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex flex-wrap items-center gap-2 font-display text-lg">
              {t.title}
              {/* ДЗ — бейджем, а не отдельным блоком: тесты группируются
                  по темам, и одна и та же тема может дать и ДЗ, и практику. */}
              {isHomework && <Tag tone="amber">Домашнее задание</Tag>}
            </h3>
            <div className="mt-0.5 text-xs text-ink-faint">
              {count} {plural(count, "вопрос", "вопроса", "вопросов")}
              {t.time_limit_min
                ? ` · ${t.time_limit_min} мин`
                : " · без таймера"}
              {best && ` · лучший результат: ${best}`}
            </div>
          </div>

          <div className="shrink-0">
            {running ? (
              <Button href={`/student/tests/${running}`}>Продолжить</Button>
            ) : (
              <form action={startTest}>
                <input type="hidden" name="test_id" value={t.id} />
                <input
                  type="hidden"
                  name="student_lesson_id"
                  value={lessonByTest.get(t.id) ?? ""}
                />
                <Button type="submit" variant={history.length > 0 ? "outline" : "amber"}>
                  {history.length > 0 ? "Пройти заново" : "Начать тест"}
                </Button>
              </form>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="border-t border-border pt-2">
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-faint">
              Мои попытки
            </div>
            {history.map((a) => {
              const over = isOvertime(
                a.started_at,
                a.finished_at,
                t.time_limit_min,
              );
              return (
                <Link
                  key={a.id}
                  href={`/student/tests/${a.id}/result`}
                  className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0 hover:text-green-700"
                >
                  <span className="text-ink-soft">
                    {formatDateTime(a.finished_at)}
                    {over && (
                      <span className="text-coral"> · не уложился</span>
                    )}
                  </span>
                  {a.status === "pending_review" ? (
                    <Tag tone="amber">на проверке</Tag>
                  ) : (
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
                      {a.score ?? 0}/{a.total ?? 0}
                    </Tag>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  // Группируем ВСЁ по темам, включая ДЗ: так просил заказчик, и это честнее —
  // одна тема может дать и заданный тест, и тест для самопроверки.
  // Темы, где есть ДЗ, поднимаем наверх: это то, что нужно сделать в первую очередь.
  const byTopic = new Map<
    string,
    { title: string; tests: typeof all; hasHomework: boolean }
  >();
  for (const t of all) {
    const key = t.topic_id ?? "none";
    const entry = byTopic.get(key) ?? {
      title: t.topics?.title ?? "Без темы",
      tests: [],
      hasHomework: false,
    };
    entry.tests.push(t);
    if (homeworkTestIds.has(t.id)) entry.hasHomework = true;
    byTopic.set(key, entry);
  }

  const groups = [...byTopic.entries()].sort(
    ([, a], [, b]) => Number(b.hasHomework) - Number(a.hasHomework),
  );

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl">Тесты</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Доступны тесты по темам пройденных занятий
      </p>

      {all.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Тестов пока нет"
            note="Тесты открываются после занятия по соответствующей теме."
          />
        </Card>
      ) : (
        <>
          {groups.map(([key, group]) => (
            <div key={key} className="mb-8">
              <CardTitle>
                {group.title}
                {group.hasHomework && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-amber-600">
                    есть домашнее задание
                  </span>
                )}
              </CardTitle>
              <div className="flex flex-col gap-3">
                {group.tests.map(renderTest)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
