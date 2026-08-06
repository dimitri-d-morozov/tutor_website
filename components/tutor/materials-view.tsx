"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cell, Row, Table } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { formatFileSize } from "@/components/ui/file-input";
import { MaterialForm, type MaterialFormValues } from "./material-form";
import { deleteMaterial } from "@/app/(tutor)/tutor/materials/actions";
import { levelLabels, materialTypeLabels } from "@/lib/labels";
import type { Database } from "@/types/database.types";

type Level = Database["public"]["Enums"]["exam_type"];
type MaterialType = Database["public"]["Enums"]["material_type"];

export type MaterialRow = {
  id: string;
  title: string;
  type: MaterialType;
  levels: Level[];
  description: string | null;
  external_url: string | null;
  file_name: string | null;
  file_size: number | null;
  section_id: string | null;
  topic_id: string | null;
  sectionTitle: string | null;
  topicTitle: string | null;
};

/**
 * Таблица материалов с модалками добавления/правки и редактором отделов.
 *
 * Клиентский компонент, потому что держит состояние открытых модалок и то,
 * какой материал сейчас правим. Данные приходят готовыми из Server Component —
 * фильтрация и запросы остаются на сервере.
 */
export function MaterialsView({
  materials,
  sections,
  topics,
  filters,
}: {
  materials: MaterialRow[];
  sections: Array<{ id: string; title: string }>;
  topics: Array<{ id: string; title: string; code: string | null }>;
  /** Панель фильтров — рендерится на сервере (обычные ссылки, без JS). */
  filters?: React.ReactNode;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialFormValues | null>(null);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">Материалы</h1>
          <p className="text-sm text-ink-soft">
            Библиотека — загружается один раз, используется в любом количестве
            уроков
          </p>
        </div>
        <div className="shrink-0">
          <Button onClick={() => setAddOpen(true)}>+ Добавить материал</Button>
        </div>
      </div>

      {filters}

      <Card className="p-0">
        {materials.length === 0 ? (
          <EmptyState
            title="Материалов пока нет"
            note="Загрузите презентацию, конспект или добавьте ссылку на видео — дальше их можно прикреплять к занятиям."
            action={
              <Button onClick={() => setAddOpen(true)}>
                + Добавить материал
              </Button>
            }
          />
        ) : (
          <div className="p-4">
            <Table
              head={["Название", "Тип", "Отдел", "Уровень", "Тема", ""]}
            >
              {materials.map((m) => (
                <Row key={m.id}>
                  <Cell>
                    <a
                      href={`/api/materials/${m.id}/open`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:text-green-700 hover:underline"
                    >
                      {m.title}
                    </a>
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
                  </Cell>
                  <Cell>
                    <Tag>{materialTypeLabels[m.type]}</Tag>
                  </Cell>
                  <Cell className="text-ink-soft">{m.sectionTitle ?? "—"}</Cell>
                  <Cell>
                    {m.levels.length === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.levels.map((l) => (
                          <Tag key={l} tone="amber">
                            {levelLabels[l]}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </Cell>
                  <Cell className="text-ink-soft">{m.topicTitle ?? "—"}</Cell>
                  <Cell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setEditing({
                            id: m.id,
                            title: m.title,
                            type: m.type,
                            levels: m.levels,
                            topic_id: m.topic_id,
                            section_id: m.section_id,
                            description: m.description,
                            hasFile: m.external_url === null,
                          })
                        }
                      >
                        Изменить
                      </Button>
                      <form action={deleteMaterial}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          className="text-coral"
                        >
                          Удалить
                        </Button>
                      </form>
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <MaterialForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sections={sections}
        topics={topics}
      />

      {editing && (
        <MaterialForm
          // key заставляет пересоздать форму при смене материала — иначе
          // defaultValue полей останется от предыдущего.
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          sections={sections}
          topics={topics}
          material={editing}
        />
      )}

    </>
  );
}
