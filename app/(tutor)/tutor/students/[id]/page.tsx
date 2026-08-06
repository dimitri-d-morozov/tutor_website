import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EditStudentButton } from "@/components/tutor/student-form";
import { StudentPlan, type PlanLesson } from "@/components/tutor/student-plan";
import { syncPlanWithCourse } from "../actions";
import {
  examTypeLabels,
  formatDate,
  formatDateTime,
  paymentStatusLabels,
} from "@/lib/labels";
import { isOvertime } from "@/lib/tests/attempt";

/** Строка «подпись — значение». */
function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("tutor");
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, student_profiles(exam_type, course_id, grade, phone, messenger, parent_name, parent_phone, tariff, status, tutor_note)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!student || student.role !== "student") notFound();
  const sp = student.student_profiles;

  const [
    { data: rawLessons },
    { data: courses },
    { data: allMaterials },
    { data: allTests },
    { data: topics },
    { data: payments },
    { data: attempts },
    { data: progress },
  ] = await Promise.all([
    supabase
      .from("student_lessons")
      .select(
        `id, position, status, scheduled_at, meeting_url, tutor_note, title, topic_id,
         topics(title, code),
         student_lesson_materials(material_id, role, position, materials(title, type)),
         student_lesson_tests(test_template_id, position, test_templates(title))`,
      )
      .eq("student_id", id)
      .order("position"),
    supabase.from("courses").select("id, title, level").order("title"),
    supabase.from("materials").select("id, title, type").order("title"),
    supabase.from("test_templates").select("id, title").order("title"),
    supabase
      .from("topics")
      .select("id, title, code, section_id")
      .order("position"),
    supabase
      .from("payments")
      .select("id, paid_on, amount, status")
      .eq("student_id", id)
      .order("paid_on", { ascending: false }),
    supabase
      .from("student_test_attempts")
      .select(
        "id, status, score, total, started_at, finished_at, test_templates(id, title, time_limit_min, topic_id)",
      )
      .eq("student_id", id)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false }),
    supabase
      .from("student_topic_progress")
      .select("topic_id, earned_points, max_points, percent")
      .eq("student_id", id),
  ]);

  const topicTitles = new Map((topics ?? []).map((t) => [t.id, t.title]));

  const raw = rawLessons ?? [];

  // «Занятие 2 из 3» считаем здесь, а не храним в БД: любая правка плана
  // (удалили занятие в середине) сделала бы сохранённые номера неверными.
  const perTopicTotal = new Map<string, number>();
  for (const l of raw) {
    if (!l.topic_id) continue;
    perTopicTotal.set(l.topic_id, (perTopicTotal.get(l.topic_id) ?? 0) + 1);
  }
  const perTopicSeen = new Map<string, number>();

  const lessons: PlanLesson[] = raw.map((l) => {
    const seen = l.topic_id ? (perTopicSeen.get(l.topic_id) ?? 0) + 1 : 1;
    if (l.topic_id) perTopicSeen.set(l.topic_id, seen);

    return {
      id: l.id,
      position: l.position,
      // Переименование занятия важнее названия темы: «Разбор ошибок» точнее.
      title: l.title ?? l.topics?.title ?? "Занятие",
      topicId: l.topic_id,
      topicTitle: l.topics?.title ?? null,
      indexInTopic: seen,
      countInTopic: l.topic_id ? (perTopicTotal.get(l.topic_id) ?? 1) : 1,
      status: l.status,
      scheduled_at: l.scheduled_at,
      meeting_url: l.meeting_url,
      tutor_note: l.tutor_note,
      materials: [...l.student_lesson_materials]
        .sort((a, b) => a.position - b.position)
        .map((m) => ({
          material_id: m.material_id,
          role: m.role,
          title: m.materials.title,
          type: m.materials.type,
        })),
      tests: [...l.student_lesson_tests]
        .sort((a, b) => a.position - b.position)
        .map((t) => ({
          test_template_id: t.test_template_id,
          title: t.test_templates.title,
        })),
    };
  });

  const completed = lessons.filter((l) => l.status === "completed").length;
  const lastPayment = (payments ?? [])[0];

  // Попытки группируем по теме, внутри темы — по дате (свежие сверху; запрос уже
  // отсортирован). Так видно, где ученик буксует, а не просто «последние 10».
  const attemptsByTopic = new Map<string, typeof attempts>();
  for (const a of attempts ?? []) {
    const key = a.test_templates?.topic_id ?? "none";
    const acc = attemptsByTopic.get(key) ?? [];
    acc.push(a);
    attemptsByTopic.set(key, acc);
  }
  const courseTitle = sp?.course_id
    ? (courses ?? []).find((c) => c.id === sp.course_id)?.title
    : null;

  return (
    <div>
      <Link
        href="/tutor/students"
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← Ко всем ученикам
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">
            {student.full_name || "Без имени"}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {sp?.exam_type && (
              <Tag tone="amber">{examTypeLabels[sp.exam_type]}</Tag>
            )}
            {courseTitle ? (
              <Link
                href={`/tutor/courses/${sp?.course_id}`}
                className="font-medium text-green-700 hover:underline"
              >
                {courseTitle}
              </Link>
            ) : (
              <span className="text-coral">программа не выбрана</span>
            )}
            {sp?.grade && <span>{sp.grade}</span>}
            <span>
              Проведено {completed} из {lessons.length}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Идемпотентная догенерация: добавит занятия по темам, которых
              в плане ещё нет, не тронув правки и отметки «проведено». */}
          <form action={syncPlanWithCourse}>
            <input type="hidden" name="id" value={student.id} />
            <Button type="submit" variant="ghost" disabled={!sp?.course_id}>
              Дополнить план по программе
            </Button>
          </form>
          <EditStudentButton
            courses={courses ?? []}
            student={{
              id: student.id,
              full_name: student.full_name,
              exam_type: sp?.exam_type ?? "ege",
              course_id: sp?.course_id ?? null,
              grade: sp?.grade ?? null,
              phone: sp?.phone ?? null,
              messenger: sp?.messenger ?? null,
              parent_name: sp?.parent_name ?? null,
              parent_phone: sp?.parent_phone ?? null,
              tariff: sp?.tariff ?? null,
              status: sp?.status ?? "active",
              tutor_note: sp?.tutor_note ?? null,
            }}
          />
        </div>
      </div>

      <StudentPlan
        studentId={student.id}
        lessons={lessons}
        allMaterials={allMaterials ?? []}
        allTests={(allTests ?? []).map((t) => ({ id: t.id, label: t.title }))}
        topicOptions={(topics ?? []).map((t) => ({
          id: t.id,
          label: t.code ? `${t.code} · ${t.title}` : t.title,
        }))}
      />

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Попытки тестов</CardTitle>
          {(attempts ?? []).length === 0 ? (
            <p className="text-sm text-ink-faint">Тесты пока не проходились</p>
          ) : (
            [...attemptsByTopic.entries()].map(([topicId, list]) => (
              <div key={topicId} className="mb-4 last:mb-0">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-ink-faint">
                  {topicId === "none"
                    ? "Без темы"
                    : topicTitles.get(topicId) ?? "—"}
                </div>
                {(list ?? []).map((a) => {
                  const limit = a.test_templates?.time_limit_min ?? null;
                  const over = isOvertime(a.started_at, a.finished_at, limit);
                  return (
                    <Link
                      key={a.id}
                      href={`/tutor/students/${id}/attempts/${a.id}`}
                      className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0 hover:text-green-700"
                    >
                      <div>
                        <div className="font-medium">
                          {a.test_templates?.title ?? "Тест"}
                        </div>
                        <div className="text-xs text-ink-faint">
                          {formatDateTime(a.finished_at)}
                          {over && (
                            <span className="text-coral"> · не уложился</span>
                          )}
                        </div>
                      </div>
                      {a.status === "pending_review" ? (
                        <Tag tone="amber">ждёт проверки</Tag>
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
            ))
          )}
        </Card>

        <Card>
          <CardTitle>Прогресс по темам</CardTitle>
          {(progress ?? []).length === 0 ? (
            <p className="text-sm text-ink-faint">
              Появится после первых пройденных тестов
            </p>
          ) : (
            (progress ?? []).map((p) => (
              <InfoRow
                key={p.topic_id}
                label={
                  p.topic_id ? topicTitles.get(p.topic_id) ?? "—" : "Без темы"
                }
              >
                {p.percent ?? 0}%
              </InfoRow>
            ))
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Контакты</CardTitle>
          <InfoRow label="Телефон">{sp?.phone ?? "—"}</InfoRow>
          <InfoRow label="Мессенджер">{sp?.messenger ?? "—"}</InfoRow>
          <InfoRow label="Родитель">{sp?.parent_name ?? "—"}</InfoRow>
          <InfoRow label="Телефон родителя">{sp?.parent_phone ?? "—"}</InfoRow>
        </Card>

        <Card>
          <CardTitle>Оплата</CardTitle>
          <InfoRow label="Тариф">{sp?.tariff ?? "—"}</InfoRow>
          <InfoRow label="Последний платёж">
            {lastPayment ? (
              <Tag
                tone={
                  lastPayment.status === "paid"
                    ? "green"
                    : lastPayment.status === "pending"
                      ? "amber"
                      : "coral"
                }
              >
                {formatDate(lastPayment.paid_on)} ·{" "}
                {paymentStatusLabels[lastPayment.status]}
              </Tag>
            ) : (
              "—"
            )}
          </InfoRow>
          {(payments ?? []).length > 0 && (
            <>
              <CardTitle className="mt-4">История платежей</CardTitle>
              {(payments ?? []).map((p) => (
                <InfoRow
                  key={p.id}
                  label={`${formatDate(p.paid_on)} · ${Number(p.amount).toLocaleString("ru-RU")} ₽`}
                >
                  <Tag
                    tone={
                      p.status === "paid"
                        ? "green"
                        : p.status === "pending"
                          ? "amber"
                          : "coral"
                    }
                  >
                    {paymentStatusLabels[p.status]}
                  </Tag>
                </InfoRow>
              ))}
            </>
          )}
        </Card>
      </div>

      {sp?.tutor_note && (
        <Card className="mt-4">
          <CardTitle>Заметка о ученике</CardTitle>
          <p className="text-sm">{sp.tutor_note}</p>
        </Card>
      )}
    </div>
  );
}
