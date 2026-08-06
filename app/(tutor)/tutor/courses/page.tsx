import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { NewCourseButton } from "@/components/tutor/course-form";
import { deleteCourse } from "./actions";
import { levelLabels, plural } from "@/lib/labels";

export default async function CoursesPage() {
  await requireRole("tutor");
  const supabase = await createClient();

  const [{ data: courses }, { data: courseTopics }, { data: students }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, title, level")
        .order("level")
        .order("title"),
      supabase.from("course_topics").select("course_id, planned_lessons"),
      supabase.from("student_profiles").select("course_id"),
    ]);

  // Итоги по программе: сколько тем и сколько занятий получится при генерации.
  const stats = new Map<string, { topics: number; lessons: number }>();
  for (const ct of courseTopics ?? []) {
    const acc = stats.get(ct.course_id) ?? { topics: 0, lessons: 0 };
    acc.topics += 1;
    acc.lessons += ct.planned_lessons;
    stats.set(ct.course_id, acc);
  }

  const enrolled = new Map<string, number>();
  for (const s of students ?? []) {
    if (!s.course_id) continue;
    enrolled.set(s.course_id, (enrolled.get(s.course_id) ?? 0) + 1);
  }

  const list = courses ?? [];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">Программы</h1>
          <p className="text-sm text-ink-soft">
            Последовательность тем под уровень подготовки. Из программы
            генерируется план ученика на год вперёд
          </p>
        </div>
        <div className="shrink-0">
          <NewCourseButton />
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Программ пока нет"
            note="Создайте программу под уровень — например «ЕГЭ годовой» — и соберите в ней последовательность тем."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((c) => {
            const s = stats.get(c.id) ?? { topics: 0, lessons: 0 };
            const students = enrolled.get(c.id) ?? 0;
            // Ориентир при занятиях раз в неделю — помогает понять, влезает ли
            // программа в учебный год.
            const weeks = s.lessons;

            return (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3.5 transition-colors hover:border-green-500"
              >
                <Link href={`/tutor/courses/${c.id}`} className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.title}</span>
                    <Tag tone="amber">{levelLabels[c.level]}</Tag>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {s.topics} {plural(s.topics, "тема", "темы", "тем")} ·{" "}
                    {s.lessons}{" "}
                    {plural(s.lessons, "занятие", "занятия", "занятий")}
                    {weeks > 0 &&
                      ` · около ${weeks} ${plural(weeks, "недели", "недель", "недель")} при занятиях раз в неделю`}
                    {students > 0 &&
                      ` · ${students} ${plural(students, "ученик", "ученика", "учеников")}`}
                  </div>
                </Link>

                <form action={deleteCourse} className="flex-none">
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="ghost" className="text-coral">
                    Удалить
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
