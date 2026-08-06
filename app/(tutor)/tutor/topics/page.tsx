import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import {
  EditTopicButton,
  NewTopicButton,
} from "@/components/tutor/topic-form";
import { SectionsEditor } from "@/components/tutor/sections-editor";
import { deleteTopic, moveTopic } from "./actions";
import { levelLabels, plural } from "@/lib/labels";

/** Одна тема в списке: код, название, уровни, счётчики, действия. */
function TopicRow({
  topic,
  sections,
  index,
  total,
  materials,
  tests,
}: {
  topic: {
    id: string;
    title: string;
    code: string | null;
    section_id: string | null;
    levels: string[];
  };
  sections: Array<{ id: string; title: string }>;
  index: number;
  total: number;
  materials: number;
  tests: number;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      <Link
        href={`/tutor/topics/${topic.id}`}
        className="flex flex-1 items-center gap-2"
      >
        {topic.code && (
          <span className="font-mono text-xs text-ink-faint">{topic.code}</span>
        )}
        <span className="text-sm font-medium hover:text-green-700 hover:underline">
          {topic.title}
        </span>
        <span className="flex gap-1">
          {topic.levels.map((l) => (
            <Tag key={l} tone="amber">
              {levelLabels[l as keyof typeof levelLabels]}
            </Tag>
          ))}
        </span>
        <span className="text-xs text-ink-faint">
          {materials} {plural(materials, "материал", "материала", "материалов")}
          {tests > 0 && ` · ${tests} ДЗ`}
        </span>
      </Link>

      <div className="flex flex-none items-center gap-0.5">
        <form action={moveTopic}>
          <input type="hidden" name="id" value={topic.id} />
          <input type="hidden" name="direction" value="up" />
          <Button type="submit" variant="ghost" disabled={index === 0} className="px-2">
            ↑
          </Button>
        </form>
        <form action={moveTopic}>
          <input type="hidden" name="id" value={topic.id} />
          <input type="hidden" name="direction" value="down" />
          <Button
            type="submit"
            variant="ghost"
            disabled={index === total - 1}
            className="px-2"
          >
            ↓
          </Button>
        </form>
        <EditTopicButton sections={sections} topic={topic} />
        <form action={deleteTopic}>
          <input type="hidden" name="id" value={topic.id} />
          <Button type="submit" variant="ghost" className="text-coral">
            Удалить
          </Button>
        </form>
      </div>
    </div>
  );
}

export default async function TopicsPage() {
  await requireRole("tutor");
  const supabase = await createClient();

  const [{ data: sections }, { data: topics }] = await Promise.all([
    supabase.from("sections").select("id, title").order("position"),
    supabase
      .from("topics")
      .select(
        "id, title, code, section_id, levels, position, topic_materials(count), topic_tests(count)",
      )
      .order("position"),
  ]);

  const all = topics ?? [];
  const sectionList = sections ?? [];

  // Темы без отдела показываем отдельной группой в конце: они не теряются,
  // но видно, что их надо разложить.
  const groups = [
    ...sectionList.map((s) => ({
      id: s.id as string | null,
      title: s.title,
      topics: all.filter((t) => t.section_id === s.id),
    })),
    {
      id: null,
      title: "Без отдела",
      topics: all.filter((t) => t.section_id === null),
    },
  ].filter((g) => g.id !== null || g.topics.length > 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">Темы</h1>
          <p className="text-sm text-ink-soft">
            Тема — единица плана. Материалы и ДЗ прикрепляются к теме, а сколько
            занятий она займёт — зависит от ученика
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <SectionsEditor sections={sectionList} />
          <NewTopicButton sections={sectionList} />
        </div>
      </div>

      {all.length === 0 && sectionList.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Ни отделов, ни тем"
            note="Начните с отделов (Ботаника, Генетика…), затем добавьте в них темы."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Card key={g.id ?? "none"}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <CardTitle className="mb-0">
                  {g.title}
                  <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
                    {g.topics.length}{" "}
                    {plural(g.topics.length, "тема", "темы", "тем")}
                  </span>
                </CardTitle>
                {g.id && (
                  <NewTopicButton
                    sections={sectionList}
                    sectionId={g.id}
                    label="+ Тема"
                    variant="ghost"
                  />
                )}
              </div>

              {g.topics.length === 0 ? (
                <p className="py-2 text-sm text-ink-faint">
                  В этом отделе пока нет тем
                </p>
              ) : (
                g.topics.map((t, i) => (
                  <TopicRow
                    key={t.id}
                    topic={t}
                    sections={sectionList}
                    index={i}
                    total={g.topics.length}
                    materials={t.topic_materials[0]?.count ?? 0}
                    tests={t.topic_tests[0]?.count ?? 0}
                  />
                ))
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
