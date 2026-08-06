"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import {
  addLessonForTopic,
  attachStudentMaterial,
  attachStudentTest,
  detachStudentMaterial,
  detachStudentTest,
  moveStudentLesson,
  removeStudentLesson,
  setLessonStatus,
  updateStudentLesson,
} from "@/app/(tutor)/tutor/students/actions";
import { formatDateTime, materialTypeLabels } from "@/lib/labels";
import type { Database } from "@/types/database.types";

type MaterialType = Database["public"]["Enums"]["material_type"];
type MaterialRole = Database["public"]["Enums"]["lesson_material_role"];

export type PlanLesson = {
  id: string;
  position: number;
  /** Заголовок: переименование занятия, иначе название темы. */
  title: string;
  topicId: string | null;
  topicTitle: string | null;
  /** Номер занятия по этой теме и всего занятий по ней — считается при рендере. */
  indexInTopic: number;
  countInTopic: number;
  status: "upcoming" | "completed";
  scheduled_at: string | null;
  meeting_url: string | null;
  tutor_note: string | null;
  materials: Array<{
    material_id: string;
    role: MaterialRole;
    title: string;
    type: MaterialType;
  }>;
  tests: Array<{ test_template_id: string; title: string }>;
};

type Option = { id: string; label: string };

/** Значение для <input type="datetime-local"> из ISO-строки. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * План занятий ученика: последовательность занятий, каждому присвоена тема.
 * Одна тема может занимать несколько занятий — это свойство ученика, а не
 * программы, поэтому «добавить ещё занятие по теме» живёт именно здесь.
 *
 * Главное действие — «Отметить проведённым»: именно оно открывает ученику
 * материалы и ДЗ занятия. До этого он видит только название, дату и ссылку.
 */
export function StudentPlan({
  studentId,
  lessons,
  allMaterials,
  allTests,
  topicOptions,
}: {
  studentId: string;
  lessons: PlanLesson[];
  allMaterials: Array<{ id: string; title: string; type: MaterialType }>;
  allTests: Option[];
  topicOptions: Option[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanLesson | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [attachTo, setAttachTo] = useState<{
    lesson: PlanLesson;
    kind: "material" | "test";
  } | null>(null);

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <CardTitle className="mb-0">План занятий</CardTitle>
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          + Добавить занятие
        </Button>
      </div>

      {lessons.length === 0 ? (
        <p className="text-sm text-ink-soft">
          План пуст. Выберите ученику программу и нажмите «Дополнить план по
          программе» — занятия создадутся по всем её темам.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lessons.map((l, i) => {
            const done = l.status === "completed";
            const open = expanded === l.id;

            return (
              <div
                key={l.id}
                className="rounded-md border border-border bg-surface"
              >
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <div
                    className={
                      done
                        ? "hex flex h-8 w-8 flex-none items-center justify-center bg-green-700 text-xs font-bold text-white"
                        : "hex flex h-8 w-8 flex-none items-center justify-center bg-green-100 text-xs font-bold text-green-700"
                    }
                  >
                    {done ? "✓" : i + 1}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : l.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {l.title}
                      {/* Тема шире одного занятия — показываем, какое это по счёту. */}
                      {l.countInTopic > 1 && (
                        <span className="text-xs font-normal text-ink-faint">
                          занятие {l.indexInTopic} из {l.countInTopic}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span>{formatDateTime(l.scheduled_at)}</span>
                      {l.topicTitle ? (
                        <Tag>{l.topicTitle}</Tag>
                      ) : (
                        <Tag tone="coral">тема не указана</Tag>
                      )}
                      <span>
                        {l.materials.length} мат. · {l.tests.length} ДЗ
                      </span>
                    </div>
                  </button>

                  <Tag tone={done ? "green" : "amber"}>
                    {done ? "Пройдено" : "Предстоит"}
                  </Tag>

                  <div className="flex flex-none items-center gap-0.5">
                    <form action={moveStudentLesson}>
                      <input type="hidden" name="student_id" value={studentId} />
                      <input type="hidden" name="lesson_id" value={l.id} />
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
                    <form action={moveStudentLesson}>
                      <input type="hidden" name="student_id" value={studentId} />
                      <input type="hidden" name="lesson_id" value={l.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        disabled={i === lessons.length - 1}
                        className="px-2"
                      >
                        ↓
                      </Button>
                    </form>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => setExpanded(open ? null : l.id)}
                  >
                    {open ? "Свернуть" : "Открыть"}
                  </Button>
                </div>

                {open && (
                  <div className="border-t border-border px-3.5 py-3">
                    {/* Статус — самое важное действие: он управляет видимостью. */}
                    <form
                      action={setLessonStatus}
                      className="mb-4 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="lesson_id" value={l.id} />
                      <input type="hidden" name="student_id" value={studentId} />
                      <input
                        type="hidden"
                        name="completed"
                        value={done ? "false" : "true"}
                      />
                      {!done && (
                        <Field label="Дата проведения" className="w-56">
                          <Input
                            type="datetime-local"
                            name="held_on"
                            defaultValue={toLocalInput(l.scheduled_at)}
                          />
                        </Field>
                      )}
                      <Button type="submit" variant={done ? "outline" : "amber"}>
                        {done
                          ? "Вернуть в «предстоит»"
                          : "Отметить проведённым"}
                      </Button>
                      <span className="pb-2 text-xs text-ink-faint">
                        {done
                          ? "Материалы и ДЗ видны ученику"
                          : "Пока занятие не проведено, ученик видит только название, дату и ссылку"}
                      </span>
                    </form>

                    {/* Материалы */}
                    <div className="mb-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                          Материалы
                        </span>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setAttachTo({ lesson: l, kind: "material" })
                          }
                        >
                          + Добавить
                        </Button>
                      </div>
                      {l.materials.length === 0 ? (
                        <p className="text-sm text-ink-faint">Нет материалов</p>
                      ) : (
                        l.materials.map((m) => (
                          <div
                            key={m.material_id}
                            className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <Tag
                                tone={
                                  m.role === "presentation" ? "green" : "amber"
                                }
                              >
                                {m.role === "presentation"
                                  ? "Презентация"
                                  : "Доп."}
                              </Tag>
                              <span className="text-sm">{m.title}</span>
                              <span className="text-xs text-ink-faint">
                                {materialTypeLabels[m.type]}
                              </span>
                            </div>
                            <form action={detachStudentMaterial}>
                              <input
                                type="hidden"
                                name="lesson_id"
                                value={l.id}
                              />
                              <input
                                type="hidden"
                                name="student_id"
                                value={studentId}
                              />
                              <input
                                type="hidden"
                                name="material_id"
                                value={m.material_id}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                className="text-coral"
                              >
                                Убрать
                              </Button>
                            </form>
                          </div>
                        ))
                      )}
                    </div>

                    {/* ДЗ */}
                    <div className="mb-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                          Домашнее задание
                        </span>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setAttachTo({ lesson: l, kind: "test" })
                          }
                        >
                          + Задать тест
                        </Button>
                      </div>
                      {l.tests.length === 0 ? (
                        <p className="text-sm text-ink-faint">ДЗ не задано</p>
                      ) : (
                        l.tests.map((t) => (
                          <div
                            key={t.test_template_id}
                            className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <Tag tone="amber">Тест</Tag>
                              <span className="text-sm">{t.title}</span>
                            </div>
                            <form action={detachStudentTest}>
                              <input
                                type="hidden"
                                name="lesson_id"
                                value={l.id}
                              />
                              <input
                                type="hidden"
                                name="student_id"
                                value={studentId}
                              />
                              <input
                                type="hidden"
                                name="test_template_id"
                                value={t.test_template_id}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                className="text-coral"
                              >
                                Убрать
                              </Button>
                            </form>
                          </div>
                        ))
                      )}
                    </div>

                    {l.tutor_note && (
                      <p className="mb-3 rounded-sm bg-surface-muted px-3 py-2 text-sm">
                        <span className="text-ink-faint">Заметка: </span>
                        {l.tutor_note}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setEditing(l)}>
                        Дата, ссылка, заметка
                      </Button>
                      {/* Главный сценарий разного темпа: этому ученику нужно
                          больше времени на тему — добавляем ещё занятие по ней. */}
                      {l.topicId && (
                        <form action={addLessonForTopic}>
                          <input
                            type="hidden"
                            name="student_id"
                            value={studentId}
                          />
                          <input
                            type="hidden"
                            name="topic_id"
                            value={l.topicId}
                          />
                          {/* Материалы уже лежат на первом занятии по теме —
                              во втором их дублировать не нужно. */}
                          <input
                            type="hidden"
                            name="copy_content"
                            value="false"
                          />
                          <Button type="submit" variant="outline">
                            + Ещё занятие по этой теме
                          </Button>
                        </form>
                      )}
                      <form action={removeStudentLesson}>
                        <input type="hidden" name="lesson_id" value={l.id} />
                        <input
                          type="hidden"
                          name="student_id"
                          value={studentId}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          className="text-coral"
                        >
                          Удалить занятие
                        </Button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Модалка: дата / ссылка / заметка ─── */}
      {editing && (
        <Modal
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          title={editing.title}
        >
          <form action={updateStudentLesson} className="flex flex-col gap-4">
            <input type="hidden" name="lesson_id" value={editing.id} />
            <input type="hidden" name="student_id" value={studentId} />

            <Field label="Дата и время">
              <Input
                type="datetime-local"
                name="scheduled_at"
                defaultValue={toLocalInput(editing.scheduled_at)}
              />
            </Field>

            <Field label="Ссылка на созвон" hint="Видна ученику до занятия">
              <Input
                name="meeting_url"
                type="url"
                defaultValue={editing.meeting_url ?? ""}
                placeholder="https://meet.google.com/…"
              />
            </Field>

            <Field label="Заметка по занятию" hint="Видна ученику">
              <Textarea
                name="tutor_note"
                rows={3}
                defaultValue={editing.tutor_note ?? ""}
                placeholder="Что разобрали, на что обратить внимание"
              />
            </Field>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Отмена
              </Button>
              <Button type="submit" onClick={() => setEditing(null)}>
                Сохранить
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* ─── Модалка: добавить занятие по теме ─── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Добавить занятие"
      >
        {topicOptions.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Тем пока нет. Создайте их в разделе «Темы».
          </p>
        ) : (
          <form action={addLessonForTopic} className="flex flex-col gap-4">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="copy_content" value="true" />

            <Field label="Тема занятия">
              <Select name="topic_id" required>
                {topicOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Название занятия"
              hint="Необязательно — по умолчанию берётся название темы"
            >
              <Input name="title" placeholder="Например: Разбор ошибок" />
            </Field>

            <Field label="Дата и время">
              <Input type="datetime-local" name="scheduled_at" />
            </Field>

            <p className="text-xs text-ink-faint">
              Материалы и ДЗ темы скопируются в занятие.
            </p>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" onClick={() => setAddOpen(false)}>
                Добавить
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>

      {/* ─── Модалка: прикрепить материал или ДЗ к занятию ученика ─── */}
      {attachTo && (
        <Modal
          key={`${attachTo.lesson.id}-${attachTo.kind}`}
          open
          onClose={() => setAttachTo(null)}
          title={
            attachTo.kind === "material"
              ? "Добавить материал этому ученику"
              : "Задать тест этому ученику"
          }
        >
          {attachTo.kind === "material" ? (
            (() => {
              const used = new Set(
                attachTo.lesson.materials.map((m) => m.material_id),
              );
              const free = allMaterials.filter((m) => !used.has(m.id));
              if (free.length === 0) {
                return (
                  <p className="text-sm text-ink-soft">
                    Все материалы библиотеки уже прикреплены к этому занятию.
                  </p>
                );
              }
              return (
                <form
                  action={attachStudentMaterial}
                  className="flex flex-col gap-4"
                >
                  <input
                    type="hidden"
                    name="lesson_id"
                    value={attachTo.lesson.id}
                  />
                  <input type="hidden" name="student_id" value={studentId} />
                  <Field label="Материал">
                    <Select name="material_id" required>
                      {free.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} · {materialTypeLabels[m.type]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Роль в занятии">
                    <Select name="role" defaultValue="extra">
                      <option value="presentation">Презентация</option>
                      <option value="extra">Доп. материалы</option>
                    </Select>
                  </Field>
                  <ModalFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAttachTo(null)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" onClick={() => setAttachTo(null)}>
                      Добавить
                    </Button>
                  </ModalFooter>
                </form>
              );
            })()
          ) : (
            (() => {
              const used = new Set(
                attachTo.lesson.tests.map((t) => t.test_template_id),
              );
              const free = allTests.filter((t) => !used.has(t.id));
              if (free.length === 0) {
                return (
                  <p className="text-sm text-ink-soft">
                    Свободных тестов нет — загрузите тест в разделе «Вопросы и
                    тесты».
                  </p>
                );
              }
              return (
                <form action={attachStudentTest} className="flex flex-col gap-4">
                  <input
                    type="hidden"
                    name="lesson_id"
                    value={attachTo.lesson.id}
                  />
                  <input type="hidden" name="student_id" value={studentId} />
                  <Field label="Тест">
                    <Select name="test_template_id" required>
                      {free.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <ModalFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAttachTo(null)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" onClick={() => setAttachTo(null)}>
                      Задать
                    </Button>
                  </ModalFooter>
                </form>
              );
            })()
          )}
        </Modal>
      )}
    </Card>
  );
}
