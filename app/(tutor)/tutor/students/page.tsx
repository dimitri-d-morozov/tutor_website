import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Cell, Row, Table } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { NewStudentButton } from "@/components/tutor/student-form";
import { examTypeLabels, formatDateTime } from "@/lib/labels";

export default async function StudentsPage() {
  await requireRole("tutor");
  const supabase = await createClient();

  // RLS отдаёт репетитору всех, поэтому фильтруем по роли, чтобы не показать
  // самого репетитора в списке учеников.
  const [
    { data: students },
    { data: lessons },
    { data: attempts },
    { data: courses },
    { data: courseTopics },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, student_profiles(exam_type, grade, status, course_id)",
      )
      .eq("role", "student")
      .order("full_name"),
    supabase
      .from("student_lessons")
      .select("student_id, topic_id, status, scheduled_at")
      .order("scheduled_at"),
    supabase
      .from("student_test_attempts")
      .select("student_id, status")
      .eq("status", "pending_review"),
    supabase.from("courses").select("id, title, level").order("title"),
    supabase.from("course_topics").select("course_id, planned_lessons"),
  ]);

  // Сколько занятий даёт каждая программа — показываем в форме создания ученика.
  const courseLessons = new Map<string, number>();
  for (const ct of courseTopics ?? []) {
    courseLessons.set(
      ct.course_id,
      (courseLessons.get(ct.course_id) ?? 0) + ct.planned_lessons,
    );
  }
  const courseOptions = (courses ?? []).map((c) => ({
    ...c,
    lessons: courseLessons.get(c.id) ?? 0,
  }));
  const courseTitles = new Map(courseOptions.map((c) => [c.id, c.title]));

  // Правило react-hooks/purity запрещает Date.now() в рендере, потому что при
  // повторном рендере компонента результат «поедет». Здесь это безопасно: это
  // async Server Component, он рендерится один раз на запрос, и текущее время —
  // ровно то, что нужно, чтобы отличить будущие занятия от прошедших.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  /** Ближайшее предстоящее занятие ученика. */
  const nextLesson = new Map<string, string | null>();
  for (const l of lessons ?? []) {
    if (l.status !== "upcoming" || !l.scheduled_at) continue;
    if (new Date(l.scheduled_at).getTime() < now) continue;
    if (!nextLesson.has(l.student_id)) {
      nextLesson.set(l.student_id, l.scheduled_at);
    }
  }

  /** Темы плана ученика: сколько пройдено из скольких. */
  const topicsByStudent = new Map<
    string,
    { total: Set<string>; done: Set<string> }
  >();
  for (const l of lessons ?? []) {
    if (!l.topic_id) continue;
    const acc =
      topicsByStudent.get(l.student_id) ??
      { total: new Set<string>(), done: new Set<string>() };
    acc.total.add(l.topic_id);
    if (l.status === "completed") acc.done.add(l.topic_id);
    topicsByStudent.set(l.student_id, acc);
  }

  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const lessonsThisWeek = (lessons ?? []).filter((l) => {
    if (l.status !== "upcoming" || !l.scheduled_at) return false;
    const t = new Date(l.scheduled_at).getTime();
    return t >= now && t <= weekAhead;
  }).length;

  const list = students ?? [];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">Ученики</h1>
          <p className="text-sm text-ink-soft">
            Обзор всех учеников и их занятий
          </p>
        </div>
        <div className="shrink-0">
          <NewStudentButton courses={courseOptions} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card>
          <div className="font-display text-3xl font-bold text-green-700">
            {list.length}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">Всего учеников</div>
        </Card>
        <Card>
          <div className="font-display text-3xl font-bold text-green-700">
            {lessonsThisWeek}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">
            Занятий на этой неделе
          </div>
        </Card>
        {/* Плитка ведёт в очередь проверки — иначе непонятно, куда идти
            с этим числом. */}
        <Link href="/tutor/review" className="block">
          <Card className="h-full transition-colors hover:border-green-500">
            <div className="font-display text-3xl font-bold text-green-700">
              {(attempts ?? []).length}
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              Попыток тестов на проверку
            </div>
          </Card>
        </Link>
      </div>

      <Card className="p-0">
        {list.length === 0 ? (
          <EmptyState
            title="Учеников пока нет"
            note="Создайте ученика — план занятий он получит автоматически из шаблона курса."
            action={<NewStudentButton courses={courseOptions} />}
          />
        ) : (
          <div className="p-4">
            <Table
              head={[
                "Ученик",
                "Программа",
                "Следующее занятие",
                "Темы",
                "Статус",
              ]}
            >
              {list.map((s) => {
                const sp = s.student_profiles;
                const topicAcc = topicsByStudent.get(s.id);
                const paused = sp?.status === "paused";

                return (
                  <Row key={s.id} className="hover:bg-surface-muted">
                    <Cell>
                      <Link
                        href={`/tutor/students/${s.id}`}
                        className="font-medium hover:text-green-700 hover:underline"
                      >
                        {s.full_name || "Без имени"}
                      </Link>
                      {sp?.grade && (
                        <div className="mt-0.5 text-xs text-ink-faint">
                          {sp.grade}
                        </div>
                      )}
                    </Cell>
                    <Cell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {sp?.exam_type && (
                          <Tag tone="amber">
                            {examTypeLabels[sp.exam_type]}
                          </Tag>
                        )}
                        <span className="text-xs text-ink-soft">
                          {sp?.course_id
                            ? courseTitles.get(sp.course_id) ?? "—"
                            : "программа не выбрана"}
                        </span>
                      </div>
                    </Cell>
                    <Cell className="text-ink-soft">
                      {formatDateTime(nextLesson.get(s.id) ?? null)}
                    </Cell>
                    <Cell>
                      {!topicAcc || topicAcc.total.size === 0 ? (
                        <span className="text-xs text-ink-faint">
                          нет данных
                        </span>
                      ) : (
                        <span className="text-sm font-medium">
                          {topicAcc.done.size} из {topicAcc.total.size}
                        </span>
                      )}
                    </Cell>
                    <Cell>
                      <Tag tone={paused ? "coral" : "green"}>
                        {paused ? "Приостановлено" : "Занимается"}
                      </Tag>
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
