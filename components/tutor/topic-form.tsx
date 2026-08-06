"use client";

import { useState } from "react";
import { Modal, ModalFooter, submitThenClose } from "@/components/ui/modal";
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
 *
 * `role` задаётся кнопкой, а не выбирается в модалке: кнопка стоит внутри своей
 * карточки («Презентация» / «Доп. материалы»), и раз репетитор нажал именно её —
 * роль уже сказана. Выпадающий список со своим значением по умолчанию тут только
 * вредил: материал уезжал в доп. материалы, хотя добавляли его как презентацию.
 */
export function AttachButton({
  label,
  title,
  action,
  hiddenName,
  hiddenValue,
  selectName,
  options,
  role,
  emptyNote,
}: {
  label: string;
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenName: string;
  hiddenValue: string;
  selectName: string;
  options: Array<{ id: string; label: string }>;
  role?: "presentation" | "extra";
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
          <form
            action={submitThenClose(action, () => setOpen(false))}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name={hiddenName} value={hiddenValue} />
            {role && <input type="hidden" name="role" value={role} />}

            <Field label="Выберите из библиотеки">
              <Select name={selectName} required>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit">Добавить</Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
