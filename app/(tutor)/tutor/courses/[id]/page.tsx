import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AddCourseTopicButton,
  EditCourseButton,
} from "@/components/tutor/course-form";
import {
  moveCourseTopic,
  removeCourseTopic,
  setPlannedLessons,
} from "../actions";
import { levelLabels, plural } from "@/lib/labels";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("tutor");
  const { id } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, level")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  const [{ data: rows }, { data: allTopics }, { data: sections }] =
    await Promise.all([
      supabase
        .from("course_topics")
        .select(
          "topic_id, position, planned_lessons, topics(id, title, code, levels, section_id, topic_materials(count), topic_tests(count))",
        )
        .eq("course_id", id)
        .order("position"),
      supabase
        .from("topics")
        .select("id, title, code, levels, section_id")
        .order("position"),
      supabase.from("sections").select("id, title").order("position"),
    ]);

  const topics = rows ?? [];
  const used = new Set(topics.map((t) => t.topic_id));
  const sectionTitles = new Map((sections ?? []).map((s) => [s.id, s.title]));

  const totalLessons = topics.reduce((n, t) => n + t.planned_lessons, 0);

  // Свободные темы для модалки, сгруппированные по отделам.
  const groups = [...(sections ?? []).map((s) => s.id), null]
    .map((sectionId) => ({
      section: sectionId
        ? sectionTitles.get(sectionId) ?? "—"
        : "Без отдела",
      topics: (allTopics ?? [])
        .filter((t) => t.section_id === sectionId && !used.has(t.id))
        .map((t) => ({
          id: t.id,
          label: t.code ? `${t.code} · ${t.title}` : t.title,
          levels: t.levels as string[],
        })),
    }))
    .filter((g) => g.topics.length > 0);

  return (
    <div>
      <Link
        href="/tutor/courses"
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← Ко всем программам
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 flex items-center gap-2 font-display text-3xl">
            {course.title}
            <Tag tone="amber">{levelLabels[course.level]}</Tag>
          </h1>
          <p className="text-sm text-ink-soft">
            {topics.length} {plural(topics.length, "тема", "темы", "тем")} ·{" "}
            {totalLessons}{" "}
            {plural(totalLessons, "занятие", "занятия", "занятий")} по плану
            {totalLessons > 0 &&
              ` · около ${totalLessons} ${plural(totalLessons, "недели", "недель", "недель")} при занятиях раз в неделю`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <EditCourseButton course={course} />
          <AddCourseTopicButton
            courseId={course.id}
            courseLevel={course.level}
            groups={groups}
          />
        </div>
      </div>

      {topics.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="В программе пока нет тем"
            note="Добавьте темы в том порядке, в котором проходите курс. Для каждой укажите, сколько занятий она обычно занимает."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {topics.map((row, i) => {
            const t = row.topics;
            const materials = t.topic_materials[0]?.count ?? 0;
            const tests = t.topic_tests[0]?.count ?? 0;
            const levelMatches = (t.levels as string[]).includes(course.level);

            return (
              <div
                key={row.topic_id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3.5 py-3"
              >
                <div className="hex flex h-8 w-8 flex-none items-center justify-center bg-green-100 text-xs font-bold text-green-700">
                  {i + 1}
                </div>

                <Link href={`/tutor/topics/${t.id}`} className="flex-1">
                  <div className="flex items-center gap-2">
                    {t.code && (
                      <span className="font-mono text-xs text-ink-faint">
                        {t.code}
                      </span>
                    )}
                    <span className="text-sm font-medium hover:text-green-700 hover:underline">
                      {t.title}
                    </span>
                    {/* Тема без нужного уровня — скорее опечатка в разметке темы,
                        чем осознанный выбор, поэтому подсвечиваем. */}
                    {!levelMatches && (
                      <Tag tone="coral">
                        не помечена как {levelLabels[course.level]}
                      </Tag>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {materials === 0 && tests === 0 ? (
                      <span className="text-coral">
                        нет материалов — занятие получится пустым
                      </span>
                    ) : (
                      <>
                        {materials}{" "}
                        {plural(materials, "материал", "материала", "материалов")}
                        {tests > 0 && ` · ${tests} ДЗ`}
                      </>
                    )}
                  </div>
                </Link>

                {/* Занятий по плану: сохраняется по потере фокуса — так правка
                    одного числа не требует отдельной кнопки. */}
                <form
                  action={setPlannedLessons}
                  className="flex flex-none items-center gap-2"
                >
                  <input type="hidden" name="course_id" value={course.id} />
                  <input type="hidden" name="topic_id" value={row.topic_id} />
                  <input
                    type="number"
                    name="planned_lessons"
                    min={1}
                    max={20}
                    defaultValue={row.planned_lessons}
                    className="w-16 rounded-sm border border-border bg-surface px-2 py-1.5 text-sm"
                  />
                  <Button type="submit" variant="ghost">
                    занятий
                  </Button>
                </form>

                <div className="flex flex-none items-center gap-0.5">
                  <form action={moveCourseTopic}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="topic_id" value={row.topic_id} />
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
                  <form action={moveCourseTopic}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="topic_id" value={row.topic_id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={i === topics.length - 1}
                      className="px-2"
                    >
                      ↓
                    </Button>
                  </form>
                  <form action={removeCourseTopic}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="topic_id" value={row.topic_id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="text-coral"
                    >
                      Убрать
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
