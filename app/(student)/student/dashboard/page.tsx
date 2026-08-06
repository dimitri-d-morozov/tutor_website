import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { formatDate, formatDateTime, plural } from "@/lib/labels";

export default async function StudentDashboard() {
  const profile = await requireRole("student");
  const firstName = (profile.full_name || "").split(" ")[0] || "друг";
  const supabase = await createClient();

  const [{ data: lessons }, { data: attempts }] = await Promise.all([
    supabase
      .from("student_lessons")
      .select("id, status, scheduled_at, meeting_url, title, topic_id, topics(title)")
      .eq("student_id", profile.id)
      .order("position"),
    supabase
      .from("student_test_attempts")
      .select("id, status, score, total, finished_at, test_templates(title)")
      .eq("student_id", profile.id)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(5),
  ]);

  // См. пояснение в /tutor/students: в async Server Component текущее время
  // безопасно — рендер один на запрос.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const next = (lessons ?? [])
    .filter(
      (l) =>
        l.status === "upcoming" &&
        l.scheduled_at &&
        new Date(l.scheduled_at).getTime() >= now,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime(),
    )[0];

  const completedCount = (lessons ?? []).filter(
    (l) => l.status === "completed",
  ).length;

  const pendingReview = (attempts ?? []).filter(
    (a) => a.status === "pending_review",
  ).length;

  // Темы плана — сколько пройдено, сколько осталось (счёт, а не проценты).
  const planTopics: Array<{ id: string; title: string; done: boolean }> = [];
  const seenTopics = new Set<string>();
  for (const l of lessons ?? []) {
    if (!l.topic_id || seenTopics.has(l.topic_id)) continue;
    seenTopics.add(l.topic_id);
    planTopics.push({
      id: l.topic_id,
      title: l.topics?.title ?? "Без темы",
      done: (lessons ?? []).some(
        (x) => x.topic_id === l.topic_id && x.status === "completed",
      ),
    });
  }

  const doneTopics = planTopics.filter((t) => t.done).length;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl">Привет, {firstName}!</h1>
      <p className="mb-8 text-ink-soft">
        Вот как продвигается подготовка к экзамену.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="border-amber-500">
            <CardTitle>Следующее занятие</CardTitle>
            {next ? (
              <>
                <h3 className="mb-1 font-display text-xl">
                  {next.title ?? next.topics?.title ?? "Занятие"}
                </h3>
                <p className="mb-4 text-sm text-ink-soft">
                  {formatDateTime(next.scheduled_at)}
                </p>
                {next.meeting_url ? (
                  <Button href={next.meeting_url}>
                    Подключиться к занятию
                  </Button>
                ) : (
                  <p className="text-xs text-ink-faint">
                    Ссылка на созвон появится ближе к занятию
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                Занятие пока не назначено — репетитор поставит дату.
              </p>
            )}
          </Card>

          <Card>
            <CardTitle>Темы</CardTitle>
            {planTopics.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Появится, когда репетитор составит план занятий.
              </p>
            ) : (
              <div>
                <div className="font-display text-2xl font-bold text-green-700">
                  {doneTopics} из {planTopics.length}
                </div>
                <div className="text-xs text-ink-soft">
                  {plural(planTopics.length, "тема", "темы", "тем")} пройдено
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Последние результаты</CardTitle>
            {(attempts ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">Тесты пока не проходились</p>
            ) : (
              (attempts ?? []).map((a) => (
                <Link
                  key={a.id}
                  href={`/student/tests/${a.id}/result`}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0 hover:text-green-700"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {a.test_templates?.title ?? "Тест"}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {formatDate(a.finished_at)}
                    </div>
                  </div>
                  {a.status === "pending_review" ? (
                    <Tag tone="amber">на проверке</Tag>
                  ) : (
                    <Tag
                      tone={
                        a.total && a.score !== null
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
              ))
            )}
          </Card>

          <Card>
            <CardTitle>Коротко</CardTitle>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Пройдено занятий</span>
                <span className="font-medium">{completedCount}</span>
              </div>
              {pendingReview > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft">Ответов на проверке</span>
                  <span className="font-medium">{pendingReview}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button href="/student/lessons" variant="outline">
                План занятий
              </Button>
              <Button href="/student/tests" variant="outline">
                Тесты
              </Button>
              <Button href="/student/mistakes" variant="outline">
                Работа над ошибками
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
