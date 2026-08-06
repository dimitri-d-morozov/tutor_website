import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { formatFileSize } from "@/components/ui/file-input";
import { materialTypeLabels } from "@/lib/labels";

/**
 * Все материалы, доступные ученику — не только с последнего занятия.
 *
 * RLS-политика materials_select уже отдаёт только материалы пройденных занятий,
 * поэтому здесь просто читаем таблицу без ручной фильтрации по видимости.
 */
export default async function StudentMaterialsPage() {
  await requireRole("student");
  const supabase = await createClient();

  const [{ data: materials, error }, { data: sections }] = await Promise.all([
    supabase
      .from("materials")
      .select(
        // Ключ связи указан явно: между materials и topics их две — прямая
        // (materials.topic_id) и через junction topic_materials, и без уточнения
        // PostgREST отвечает PGRST201 (см. CLAUDE.md, «неоднозначные связи»).
        "id, title, type, description, external_url, file_name, file_size, section_id, topic_id, topics!materials_topic_id_fkey(title)",
      )
      .order("title"),
    supabase.from("sections").select("id, title").order("position"),
  ]);

  // Молча показать «материалов нет» вместо ошибки запроса — худший из вариантов:
  // именно так эта страница и оказалась пустой при живых материалах.
  if (error) throw new Error(`Не удалось загрузить материалы: ${error.message}`);

  const list = materials ?? [];
  const sectionTitles = new Map((sections ?? []).map((s) => [s.id, s.title]));
  const sectionOrder = (sections ?? []).map((s) => s.id);

  // Раздел → тема → материалы. Раздел без материалов просто не появится —
  // группы строим только из того, что реально есть в list.
  const bySection = new Map<
    string,
    { title: string; topics: Map<string, { title: string; items: typeof list }> }
  >();
  for (const m of list) {
    const sectionKey = m.section_id ?? "none";
    const section = bySection.get(sectionKey) ?? {
      title: m.section_id ? sectionTitles.get(m.section_id) ?? "Без раздела" : "Без раздела",
      topics: new Map<string, { title: string; items: typeof list }>(),
    };
    const topicKey = m.topic_id ?? "none";
    const topic = section.topics.get(topicKey) ?? {
      title: m.topic_id ? m.topics?.title ?? "Без темы" : "Без темы",
      items: [],
    };
    topic.items.push(m);
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
      <h1 className="mb-1 font-display text-3xl">Все материалы</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Материалы занятий, которые уже прошли
      </p>

      {list.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="Материалов пока нет"
            note="Они появятся здесь по мере того, как будут проходить занятия."
          />
        </Card>
      ) : (
        sectionKeys.map((sectionKey) => {
          const section = bySection.get(sectionKey)!;
          const topicKeys = [...section.topics.keys()].sort((a, b) => {
            const at = section.topics.get(a)!.title;
            const bt = section.topics.get(b)!.title;
            return at.localeCompare(bt, "ru");
          });

          return (
            <div key={sectionKey} className="mb-8">
              <h2 className="mb-3 font-display text-xl">{section.title}</h2>
              {topicKeys.map((topicKey) => {
                const topic = section.topics.get(topicKey)!;
                return (
                  <div key={topicKey} className="mb-5">
                    <CardTitle>{topic.title}</CardTitle>
                    <Card className="p-0">
                      <div className="p-4">
                        {topic.items.map((m) => (
                          <a
                            key={m.id}
                            href={`/api/materials/${m.id}/open`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0 hover:text-green-700"
                          >
                            <div>
                              <div className="font-medium">{m.title}</div>
                              {m.description && (
                                <div className="mt-0.5 text-xs text-ink-soft">
                                  {m.description}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] text-ink-faint">
                                {m.external_url
                                  ? "Внешняя ссылка"
                                  : `Файл${m.file_size ? ` · ${formatFileSize(m.file_size)}` : ""}`}
                              </div>
                            </div>
                            <Tag className="shrink-0">
                              {materialTypeLabels[m.type]}
                            </Tag>
                          </a>
                        ))}
                      </div>
                    </Card>
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
