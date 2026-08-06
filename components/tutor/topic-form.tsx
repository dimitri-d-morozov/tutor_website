"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CheckboxGroup, Field, Input, Select } from "@/components/ui/field";
import { levelOptions } from "@/lib/labels";
import { createTopic, updateTopic } from "@/app/(tutor)/tutor/topics/actions";

type Section = { id: string; title: string };

export type TopicValues = {
  id: string;
  title: string;
  code: string | null;
  section_id: string | null;
  levels: string[];
};

/** Модалка создания/правки темы. */
function TopicModal({
  open,
  onClose,
  sections,
  topic,
  defaultSectionId,
}: {
  open: boolean;
  onClose: () => void;
  sections: Section[];
  topic?: TopicValues;
  defaultSectionId?: string | null;
}) {
  const isEdit = topic !== undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Изменить тему" : "Новая тема"}
    >
      <form
        action={isEdit ? updateTopic : createTopic}
        className="flex flex-col gap-4"
      >
        {isEdit && <input type="hidden" name="id" value={topic.id} />}

        <Field label="Название темы">
          <Input
            name="title"
            required
            defaultValue={topic?.title}
            placeholder="Например: Законы Менделя"
          />
        </Field>

        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="Код" hint="Из кодификатора">
            <Input name="code" defaultValue={topic?.code ?? ""} placeholder="3.1" />
          </Field>
          <Field label="Отдел">
            <Select
              name="section_id"
              defaultValue={topic?.section_id ?? defaultSectionId ?? ""}
            >
              <option value="">— без отдела —</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Уровни"
          hint="Одна тема может входить в несколько программ — глубину задают материалы и тесты"
        >
          <CheckboxGroup
            name="levels"
            options={levelOptions}
            selected={topic?.levels}
          />
        </Field>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" onClick={onClose}>
            Сохранить
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export function NewTopicButton({
  sections,
  sectionId,
  label = "+ Новая тема",
  variant = "amber",
}: {
  sections: Section[];
  sectionId?: string | null;
  label?: string;
  variant?: "amber" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <TopicModal
        open={open}
        onClose={() => setOpen(false)}
        sections={sections}
        defaultSectionId={sectionId}
      />
    </>
  );
}

export function EditTopicButton({
  sections,
  topic,
  label = "Изменить",
}: {
  sections: Section[];
  topic: TopicValues;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <TopicModal
        open={open}
        onClose={() => setOpen(false)}
        sections={sections}
        topic={topic}
      />
    </>
  );
}

/**
 * Модалка «добавить из библиотеки»: одна и та же для материалов темы и для ДЗ.
 * `withRole` включает выбор роли — он нужен материалам, но не тестам.
 */
export function AttachButton({
  label,
  title,
  action,
  hiddenName,
  hiddenValue,
  selectName,
  options,
  withRole = false,
  emptyNote,
}: {
  label: string;
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenName: string;
  hiddenValue: string;
  selectName: string;
  options: Array<{ id: string; label: string }>;
  withRole?: boolean;
  emptyNote: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {options.length === 0 ? (
          <p className="text-sm text-ink-soft">{emptyNote}</p>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name={hiddenName} value={hiddenValue} />

            <Field label="Выберите из библиотеки">
              <Select name={selectName} required>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            {withRole && (
              <Field label="Роль в занятии">
                <Select name="role" defaultValue="extra">
                  <option value="presentation">Презентация</option>
                  <option value="extra">
                    Доп. материалы для самостоятельного изучения
                  </option>
                </Select>
              </Field>
            )}

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" onClick={() => setOpen(false)}>
                Добавить
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
