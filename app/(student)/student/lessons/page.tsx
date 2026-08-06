import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, materialTypeLabels, plural } from "@/lib/labels";

/**
 * План занятий ученика — виден целиком.
 *
 * Пройденные занятия раскрыты: материалы, ДЗ, заметка репетитора. Предстоящие —
 * закрытые серые тайлы: только тема и дата, чтобы программа была видна вперёд,
 * а содержимое — нет.
 *
 * Правило видимости держится не на этой вёрстке, а на RLS: политики
 * slm_select / slt_select просто не отдают ученику материалы непройденного
 * занятия. Серые тайлы строятся из полей, которые ему и так доступны.
 */
export default async function StudentLessonsPage() {
  const profile = await requireRole("student");
  const supabase = await createClient();

  const { data: lessons } = await supabase
    .from("student_lessons")
    .select(
      `id, position, status, scheduled_at, meeting_url, tutor_note, title, topic_id,
       topics(title),
       student_lesson_materials(material_id, role, position, materials(title, type)),
       student_lesson_tests(test_template_id, test_templates(title, time_limit_min))`,
    )
    .eq("student_id", profile.id)
    .order("position");

  const all = lessons ?? [];

  // См. пояснение в /tutor/students: в async Server Component текущее время
  // безопасно — рендер один на запрос.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const next = all
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

  // «Занятие 2 из 3»: тема может занимать несколько занятий.
  const perTopicTotal = new Map<string, number>();
  for (const l of all) {
    if (!l.topic_id) continue;
    perTopicTotal.set(l.topic_id, (perTopicTotal.get(l.topic_id) ?? 0) + 1);
  }
  const perTopicSeen = new Map<string, number>();
  const topicIndex = new Map<string, number>();
  for (const l of all) {
    if (!l.topic_id) continue;
    const seen = (perTopicSeen.get(l.topic_id) ?? 0) + 1;
    perTopicSeen.set(l.topic_id, seen);
    topicIndex.set(l.id, seen);
  }

  const lessonTitle = (l: (typeof all)[number]) =>
    l.title ?? l.topics?.title ?? "Занятие";

  // ─── Темы плана: сколько пройдено ───
  // Знаменатель — все темы плана, а не только те, где были тесты.
  const planTopics: Array<{ id: string; title: string; done: boolean }> = [];
  const seenTopics = new Set<string>();
  for (const l of all) {
    if (!l.topic_id || seenTopics.has(l.topic_id)) continue;
    seenTopics.add(l.topic_id);
    planTopics.push({
      id: l.topic_id,
      title: l.topics?.title ?? "Без темы",
      // Тема пройдена, когда хотя бы одно занятие по ней проведено.
      done: all.some((x) => x.topic_id === l.topic_id && x.status === "completed"),
    });
  }

  const doneTopics = planTopics.filter((t) => t.done).length;

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl">План занятий</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Программа видна целиком, материалы занятия открываются после того, как оно
        прошло
      </p>

      {next && (
        <Card className="mb-6 border-amber-500">
          <CardTitle>Следующее занятие</CardTitle>
          <h2 className="mb-1 font-display text-xl">{lessonTitle(next)}</h2>
          <p className="mb-4 text-sm text-ink-soft">
            {formatDateTime(next.scheduled_at)}
          </p>
          {next.meeting_url ? (
            <Button href={next.meeting_url}>Подключиться к занятию</Button>
          ) : (
            <p className="text-xs text-ink-faint">
              Ссылка на созвон появится ближе к занятию
            </p>
          )}
        </Card>
      )}

      {all.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Занятий пока нет"
            note="Как только репетитор составит программу, она появится здесь."
          />
        </Card>
      ) : (
        <>
          {planTopics.length > 0 && (
            <Card className="mb-6">
              <CardTitle>Темы</CardTitle>
              <div className="font-display text-2xl font-bold text-green-700">
                {doneTopics} из {planTopics.length}
              </div>
              <div className="text-xs text-ink-soft">
                {plural(planTopics.length, "тема", "темы", "тем")} пройдено
              </div>
            </Card>
          )}

          <CardTitle>Занятия</CardTitle>
          <div className="flex flex-col gap-3">
            {all.map((l, i) => {
              const done = l.status === "completed";
              const multi =
                l.topic_id && (perTopicTotal.get(l.topic_id) ?? 1) > 1;

              // ─── Предстоящее: закрытый серый тайл ───
              if (!done) {
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-4 rounded-md border border-dashed border-border bg-surface-muted px-4 py-3.5"
                  >
                    <div className="hex flex h-8 w-8 flex-none items-center justify-center bg-border text-xs font-bold text-ink-faint">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink-faint">
                        {l.topics?.title ?? "Занятие"}
                        {multi && (
                          <span className="ml-2 text-xs font-normal">
                            занятие {topicIndex.get(l.id)} из{" "}
                            {perTopicTotal.get(l.topic_id!)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {formatDateTime(l.scheduled_at)}
                      </div>
                    </div>
                    <span className="flex-none text-xs text-ink-faint">
                      🔒 откроется после занятия
                    </span>
                  </div>
                );
              }

              // ─── Пройденное: полная карточка ───
              const materials = [...l.student_lesson_materials].sort(
                (a, b) => a.position - b.position,
              );
              const presentation = materials.filter(
                (m) => m.role === "presentation",
              );
              const extra = materials.filter((m) => m.role === "extra");

              return (
                <Card key={l.id}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="hex flex h-8 w-8 flex-none items-center justify-center bg-green-700 text-xs font-bold text-white">
                      ✓
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-lg">
                        Занятие {i + 1}. {lessonTitle(l)}
                      </div>
                      <div className="text-xs text-ink-faint">
                        {formatDateTime(l.scheduled_at)}
                        {multi && (
                          <>
                            {" · "}
                            {l.topics?.title}: занятие {topicIndex.get(l.id)} из{" "}
                            {perTopicTotal.get(l.topic_id!)}
                          </>
                        )}
                      </div>
                    </div>
                    <Tag>Пройдено</Tag>
                  </div>

                  {presentation.length > 0 && (
                    <div className="mb-2">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-faint">
                        Презентация
                      </div>
                      {presentation.map((m) => (
                        <a
                          key={m.material_id}
                          href={`/api/materials/${m.material_id}/open`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0 hover:text-green-700"
                        >
                          <span className="font-medium">
                            {m.materials.title}
                          </span>
                          <Tag>{materialTypeLabels[m.materials.type]}</Tag>
                        </a>
                      ))}
                    </div>
                  )}

                  {extra.length > 0 && (
                    <div className="mb-2">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-faint">
                        Для самостоятельного изучения
                      </div>
                      {extra.map((m) => (
                        <a
                          key={m.material_id}
                          href={`/api/materials/${m.material_id}/open`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0 hover:text-green-700"
                        >
                          <span className="font-medium">
                            {m.materials.title}
                          </span>
                          <Tag>{materialTypeLabels[m.materials.type]}</Tag>
                        </a>
                      ))}
                    </div>
                  )}

                  {l.student_lesson_tests.length > 0 && (
                    <div className="mb-2">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-faint">
                        Домашнее задание
                      </div>
                      {l.student_lesson_tests.map((t) => (
                        <div
                          key={t.test_template_id}
                          className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
                        >
                          <span className="font-medium">
                            {t.test_templates.title}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-ink-faint">
                              {t.test_templates.time_limit_min
                                ? `${t.test_templates.time_limit_min} мин`
                                : "без таймера"}
                            </span>
                            <Button href="/student/tests" variant="ghost">
                              Пройти →
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {l.tutor_note && (
                    <p className="mt-3 rounded-sm bg-surface-muted px-3 py-2 text-sm">
                      <span className="text-ink-faint">
                        Заметка репетитора:{" "}
                      </span>
                      {l.tutor_note}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
