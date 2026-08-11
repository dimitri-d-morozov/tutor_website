"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  updateQuestion,
  updateTest,
} from "@/app/(tutor)/tutor/bank/actions";

type Topic = { id: string; title: string; code: string | null };

/** Правка названия, темы и лимита времени теста. */
export function EditTestButton({
  test,
  topics,
}: {
  test: {
    id: string;
    title: string;
    topic_id: string | null;
    time_limit_min: number | null;
  };
  topics: Topic[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Изменить тест
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Изменить тест">
        <form action={updateTest} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={test.id} />

          <Field label="Название">
            <Input name="title" required defaultValue={test.title} />
          </Field>

          <Field label="Тема">
            <Select name="topic_id" defaultValue={test.topic_id ?? ""}>
              <option value="">— не указана —</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} · ${t.title}` : t.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Лимит времени, минут"
            hint="Пусто — тест без таймера. Лимит соблюдается на сервере"
          >
            <Input
              type="number"
              name="time_limit_min"
              min={1}
              max={300}
              defaultValue={test.time_limit_min ?? ""}
            />
          </Field>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" onClick={() => setOpen(false)}>
              Сохранить
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

/**
 * Правка вопроса.
 *
 * Состав вариантов ответа не меняем: их пересборка рассогласовала бы уже
 * сохранённые ответы учеников. Верный вариант выбрать можно, текст вариантов —
 * нет; для этого проще перезагрузить тест файлом.
 */
export function EditQuestionButton({
  question,
  options,
}: {
  question: {
    id: string;
    text: string;
    type: "single_choice" | "multiple_choice" | "open";
    correct_answer: unknown;
    explanation: string | null;
    max_points: number;
  };
  options: Array<{ id: string; text: string }>;
}) {
  const [open, setOpen] = useState(false);
  const correct =
    typeof question.correct_answer === "string" ? question.correct_answer : "";

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Изменить
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Изменить вопрос"
        className="w-[560px]"
      >
        <form action={updateQuestion} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={question.id} />

          <Field label="Текст вопроса">
            <Textarea name="text" rows={3} required defaultValue={question.text} />
          </Field>

          {question.type === "single_choice" ? (
            <Field label="Верный вариант">
              <Select name="correct_answer" defaultValue={correct}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}. {o.text}
                  </option>
                ))}
              </Select>
            </Field>
          ) : question.type === "multiple_choice" ? (
            <Field label="Верные варианты" hint="Не редактируются — удалите и перезагрузите вопрос при необходимости">
              <ul className="flex flex-col gap-1.5">
                {options.map((o) => {
                  const isCorrect = Array.isArray(question.correct_answer) && question.correct_answer.includes(o.id);
                  return (
                    <li
                      key={o.id}
                      className={
                        isCorrect
                          ? "rounded-sm bg-green-100 px-3 py-2 text-sm font-medium text-green-700"
                          : "px-3 py-2 text-sm text-ink-soft"
                      }
                    >
                      {o.id}. {o.text}
                      {isCorrect && " ✓"}
                    </li>
                  );
                })}
              </ul>
            </Field>
          ) : (
            <Field
              label="Эталонный ответ"
              hint="Виден только вам — при проверке развёрнутого ответа"
            >
              <Textarea name="correct_answer" rows={2} defaultValue={correct} />
            </Field>
          )}

          <Field
            label="Максимум баллов"
            hint={
              question.type === "open"
                ? "При проверке сможете поставить частичный балл"
                : "Начисляется целиком либо не начисляется"
            }
          >
            <Input
              type="number"
              name="max_points"
              min={1}
              max={10}
              defaultValue={question.max_points}
            />
          </Field>

          <Field label="Пояснение" hint="Ученик видит в работе над ошибками">
            <Textarea
              name="explanation"
              rows={2}
              defaultValue={question.explanation ?? ""}
            />
          </Field>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" onClick={() => setOpen(false)}>
              Сохранить
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
