import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cell, Row, Table } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteTest } from "./actions";
import { levelLabels, plural } from "@/lib/labels";

/**
 * Тесты. Отдельного «банка вопросов» здесь нет намеренно: вопросы живут внутри
 * теста, и карточка теста уже даёт с ними всё — добавить, изменить, удалить,
 * переставить. Список вопросов на этой странице только дублировал бы её, но без
 * контекста, в каком тесте вопрос стоит.
 */
export default async function BankPage() {
  await requireRole("tutor");
  const supabase = await createClient();

  const [{ data: tests }, { data: topics }, { data: sections }] =
    await Promise.all([
      supabase
        .from("test_templates")
        .select(
          "id, title, topic_id, section_id, levels, time_limit_min, test_template_questions(count)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("topics").select("id, title"),
      supabase.from("sections").select("id, title"),
    ]);

  const topicTitles = new Map((topics ?? []).map((t) => [t.id, t.title]));
  const sectionTitles = new Map((sections ?? []).map((s) => [s.id, s.title]));
  const list = tests ?? [];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-3xl">Тесты</h1>
          <p className="text-sm text-ink-soft">
            Откройте тест, чтобы посмотреть и изменить его вопросы
          </p>
        </div>
        <Button href="/tutor/bank/import" className="shrink-0">
          + Загрузить тест
        </Button>
      </div>

      <Card className="p-0">
        {list.length === 0 ? (
          <EmptyState
            title="Тестов пока нет"
            note="Тест можно загрузить файлом — попросите Клода сгенерировать его по docs/test-format.md. Отдельные вопросы потом добавляются прямо в карточке теста."
            action={<Button href="/tutor/bank/import">+ Загрузить тест</Button>}
          />
        ) : (
          <div className="p-4">
            <Table
              head={[
                "Название",
                "Тема",
                "Отдел",
                "Уровень",
                "Вопросов",
                "Лимит",
                "",
              ]}
            >
              {list.map((t) => (
                <Row key={t.id}>
                  <Cell>
                    <Link
                      href={`/tutor/bank/${t.id}`}
                      className="font-medium hover:text-green-700 hover:underline"
                    >
                      {t.title}
                    </Link>
                  </Cell>
                  <Cell>
                    {t.topic_id ? (
                      <Tag>{topicTitles.get(t.topic_id) ?? "—"}</Tag>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Cell>
                  <Cell className="text-ink-soft">
                    {t.section_id ? sectionTitles.get(t.section_id) ?? "—" : "—"}
                  </Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-1">
                      {t.levels.map((l) => (
                        <Tag key={l} tone="amber">
                          {levelLabels[l]}
                        </Tag>
                      ))}
                    </div>
                  </Cell>
                  <Cell>
                    {t.test_template_questions[0]?.count ?? 0}{" "}
                    <span className="text-xs text-ink-faint">
                      {plural(
                        t.test_template_questions[0]?.count ?? 0,
                        "вопрос",
                        "вопроса",
                        "вопросов",
                      )}
                    </span>
                  </Cell>
                  <Cell className="text-ink-soft">
                    {t.time_limit_min
                      ? `${t.time_limit_min} мин`
                      : "без таймера"}
                  </Cell>
                  <Cell>
                    <form action={deleteTest} className="flex justify-end">
                      <input type="hidden" name="id" value={t.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-coral"
                      >
                        Удалить
                      </Button>
                    </form>
                  </Cell>
                </Row>
              ))}
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
