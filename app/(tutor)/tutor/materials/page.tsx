import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  MaterialsView,
  type MaterialRow,
} from "@/components/tutor/materials-view";
import { levelOptions, materialTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { Database } from "@/types/database.types";

type Level = Database["public"]["Enums"]["exam_type"];
type MaterialType = Database["public"]["Enums"]["material_type"];

type Filters = {
  section?: string;
  level?: string;
  topic?: string;
  type?: string;
};

/** Ссылка-чип фильтра: повторный клик по активному чипу снимает фильтр. */
function FilterChip({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-green-900 bg-green-900 text-white"
          : "border-border bg-surface text-ink hover:bg-surface-muted",
      )}
    >
      {label}
    </Link>
  );
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await requireRole("tutor");
  const filters = await searchParams;
  const supabase = await createClient();

  // Справочники нужны и для фильтров, и для выпадающих списков в форме.
  const [{ data: sections }, { data: topics }] = await Promise.all([
    supabase.from("sections").select("id, title").order("position"),
    supabase.from("topics").select("id, title, code").order("position"),
  ]);

  let query = supabase
    .from("materials")
    .select(
      "id, title, type, levels, description, external_url, file_name, file_size, section_id, topic_id",
    )
    .order("created_at", { ascending: false });

  if (filters.section) query = query.eq("section_id", filters.section);
  if (filters.topic) query = query.eq("topic_id", filters.topic);
  if (filters.type) query = query.eq("type", filters.type as MaterialType);
  // levels — массив, поэтому «содержит указанный уровень», а не равенство.
  if (filters.level) query = query.contains("levels", [filters.level as Level]);

  const { data: materials } = await query;

  const sectionTitles = new Map((sections ?? []).map((s) => [s.id, s.title]));
  const topicTitles = new Map((topics ?? []).map((t) => [t.id, t.title]));

  const rows: MaterialRow[] = (materials ?? []).map((m) => ({
    ...m,
    sectionTitle: m.section_id ? sectionTitles.get(m.section_id) ?? null : null,
    topicTitle: m.topic_id ? topicTitles.get(m.topic_id) ?? null : null,
  }));

  /** Ссылка с одним изменённым параметром; то же значение — снимает фильтр. */
  const link = (key: keyof Filters, value: string) => {
    const next = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => Boolean(v)) as [
        string,
        string,
      ][],
    );
    if (next.get(key) === value) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    return qs ? `/tutor/materials?${qs}` : "/tutor/materials";
  };

  const hasFilters = Object.values(filters).some(Boolean);

  const filterPanel = (
    <div className="mb-5 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs uppercase tracking-wider text-ink-faint">
            Уровень
          </span>
          {levelOptions.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              active={filters.level === o.value}
              href={link("level", o.value)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs uppercase tracking-wider text-ink-faint">
            Тип
          </span>
          {Object.entries(materialTypeLabels).map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              active={filters.type === value}
              href={link("type", value)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs uppercase tracking-wider text-ink-faint">
            Отдел
          </span>
          {(sections ?? []).map((s) => (
            <FilterChip
              key={s.id}
              label={s.title}
              active={filters.section === s.id}
              href={link("section", s.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs uppercase tracking-wider text-ink-faint">
            Тема
          </span>
          {(topics ?? []).map((t) => (
            <FilterChip
              key={t.id}
              label={t.title}
              active={filters.topic === t.id}
              href={link("topic", t.id)}
            />
          ))}
        </div>

      {hasFilters && (
        <Link
          href="/tutor/materials"
          className="mt-1 text-[13px] font-medium text-green-700 hover:underline"
        >
          Сбросить фильтры
        </Link>
      )}
    </div>
  );

  return (
    <MaterialsView
      materials={rows}
      sections={sections ?? []}
      topics={topics ?? []}
      filters={filterPanel}
    />
  );
}
