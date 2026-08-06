import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { AttachButton, EditTopicButton } from "@/components/tutor/topic-form";
import {
  attachTopicMaterial,
  attachTopicTest,
  detachTopicMaterial,
  detachTopicTest,
} from "../actions";
import { levelLabels, materialTypeLabels, plural } from "@/lib/labels";

/** Строка «прикреплённый материал/тест + кнопка убрать». */
function AttachedRow({
  children,
  action,
  hidden,
}: {
  children: React.ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-3">{children}</div>
      <form action={action}>
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Button type="submit" variant="ghost" className="text-coral">
          Убрать
        </Button>
      </form>
    </div>
  );
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("tutor");
  const { id } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id, title, code, section_id, levels")
    .eq("id", id)
    .maybeSingle();

  if (!topic) notFound();

  const [
    { data: attachedMaterials },
    { data: attachedTests },
    { data: allMaterials },
    { data: allTests },
    { data: sections },
    { data: usedInCourses },
    { count: lessonCount },
  ] = await Promise.all([
    supabase
      .from("topic_materials")
      .select("material_id, role, position, materials(title, type)")
      .eq("topic_id", id)
      .order("position"),
    supabase
      .from("topic_tests")
      .select(
        "test_template_id, position, test_templates(title, time_limit_min, test_template_questions(count))",
      )
      .eq("topic_id", id)
      .order("position"),
    supabase.from("materials").select("id, title, type").order("title"),
    supabase.from("test_templates").select("id, title").order("title"),
    supabase.from("sections").select("id, title").order("position"),
    supabase
      .from("course_topics")
      .select("planned_lessons, courses(id, title)")
      .eq("topic_id", id),
    supabase
      .from("student_lessons")
      .select("*", { count: "exact", head: true })
      .eq("topic_id", id),
  ]);

  const materials = attachedMaterials ?? [];
  const presentation = materials.filter((m) => m.role === "presentation");
  const extra = materials.filter((m) => m.role === "extra");
  const tests = attachedTests ?? [];

  const attachedIds = new Set(materials.map((m) => m.material_id));
  const attachedTestIds = new Set(tests.map((t) => t.test_template_id));

  const sectionTitle = topic.section_id
    ? (sections ?? []).find((s) => s.id === topic.section_id)?.title
    : null;

  const materialOptions = (allMaterials ?? [])
    .filter((m) => !attachedIds.has(m.id))
    .map((m) => ({
      id: m.id,
      label: `${m.title} · ${materialTypeLabels[m.type]}`,
    }));

  return (
    <div>
      <Link
        href="/tutor/topics"
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← Ко всем темам
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">
            {topic.code && (
              <span className="mr-2 font-mono text-lg text-ink-faint">
                {topic.code}
              </span>
            )}
            {topic.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {sectionTitle ? <Tag>{sectionTitle}</Tag> : <span>Без отдела</span>}
            {topic.levels.map((l) => (
              <Tag key={l} tone="amber">
                {levelLabels[l]}
              </Tag>
            ))}
          </div>
        </div>
        <div className="shrink-0">
          <EditTopicButton
            sections={sections ?? []}
            topic={topic}
            label="Изменить тему"
          />
        </div>
      </div>

      {/* Где тема используется — чтобы правки не были «в никуда». */}
      <Card className="mb-4">
        <CardTitle>Где используется</CardTitle>
        {(usedInCourses ?? []).length === 0 ? (
          <p className="text-sm text-ink-faint">
            Тема пока не входит ни в одну программу — добавьте её в разделе
            «Программы».
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(usedInCourses ?? []).map((c) => (
              <Link
                key={c.courses.id}
                href={`/tutor/courses/${c.courses.id}`}
                className="rounded-full border border-border px-3 py-1 text-[13px] hover:bg-surface-muted"
              >
                {c.courses.title} ·{" "}
                {c.planned_lessons}{" "}
                {plural(c.planned_lessons, "занятие", "занятия", "занятий")}
              </Link>
            ))}
          </div>
        )}
        {(lessonCount ?? 0) > 0 && (
          <p className="mt-3 text-xs text-ink-faint">
            В планах учеников: {lessonCount}{" "}
            {plural(lessonCount ?? 0, "занятие", "занятия", "занятий")}. Правки
            содержимого темы на уже созданные занятия не влияют — они
            материализованы.
          </p>
        )}
      </Card>

      {/* ─── Презентация ─── */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <CardTitle className="mb-0">Презентация</CardTitle>
          <AttachButton
            label="+ Выбрать"
            title="Презентация темы"
            action={attachTopicMaterial}
            hiddenName="topic_id"
            hiddenValue={topic.id}
            selectName="material_id"
            options={materialOptions}
            withRole
            emptyNote="Все материалы библиотеки уже прикреплены к этой теме. Загрузите новый в разделе «Материалы»."
          />
        </div>
        {presentation.length === 0 ? (
          <p className="text-sm text-ink-faint">Не выбрана</p>
        ) : (
          presentation.map((m) => (
            <AttachedRow
              key={m.material_id}
              action={detachTopicMaterial}
              hidden={{ topic_id: topic.id, material_id: m.material_id }}
            >
              <Tag>{materialTypeLabels[m.materials.type]}</Tag>
              <span className="text-sm font-medium">{m.materials.title}</span>
            </AttachedRow>
          ))
        )}
      </Card>

      {/* ─── Доп. материалы ─── */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <CardTitle className="mb-0">
            Доп. материалы для самостоятельного изучения
          </CardTitle>
          <AttachButton
            label="+ Добавить из библиотеки"
            title="Добавить материал"
            action={attachTopicMaterial}
            hiddenName="topic_id"
            hiddenValue={topic.id}
            selectName="material_id"
            options={materialOptions}
            withRole
            emptyNote="Все материалы библиотеки уже прикреплены к этой теме. Загрузите новый в разделе «Материалы»."
          />
        </div>
        {extra.length === 0 ? (
          <p className="text-sm text-ink-faint">Пока ничего не добавлено</p>
        ) : (
          extra.map((m) => (
            <AttachedRow
              key={m.material_id}
              action={detachTopicMaterial}
              hidden={{ topic_id: topic.id, material_id: m.material_id }}
            >
              <Tag>{materialTypeLabels[m.materials.type]}</Tag>
              <span className="text-sm font-medium">{m.materials.title}</span>
            </AttachedRow>
          ))
        )}
      </Card>

      {/* ─── ДЗ ─── */}
      <Card>
        <div className="mb-2 flex items-center justify-between gap-3">
          <CardTitle className="mb-0">Домашнее задание</CardTitle>
          <AttachButton
            label="+ Задать тест"
            title="Тест в домашнее задание"
            action={attachTopicTest}
            hiddenName="topic_id"
            hiddenValue={topic.id}
            selectName="test_template_id"
            options={(allTests ?? [])
              .filter((t) => !attachedTestIds.has(t.id))
              .map((t) => ({ id: t.id, label: t.title }))}
            emptyNote="Свободных тестов нет. Загрузите тест в разделе «Тесты»."
          />
        </div>
        {tests.length === 0 ? (
          <p className="text-sm text-ink-faint">
            ДЗ не задано. Пока в качестве ДЗ можно задавать только тесты.
          </p>
        ) : (
          tests.map((t) => {
            const count = t.test_templates.test_template_questions[0]?.count ?? 0;
            return (
              <AttachedRow
                key={t.test_template_id}
                action={detachTopicTest}
                hidden={{
                  topic_id: topic.id,
                  test_template_id: t.test_template_id,
                }}
              >
                <Tag tone="amber">Тест</Tag>
                <span className="text-sm font-medium">
                  {t.test_templates.title}
                </span>
                <span className="text-xs text-ink-faint">
                  {count} {plural(count, "вопрос", "вопроса", "вопросов")}
                  {t.test_templates.time_limit_min
                    ? ` · ${t.test_templates.time_limit_min} мин`
                    : ""}
                </span>
              </AttachedRow>
            );
          })
        )}
      </Card>
    </div>
  );
}
