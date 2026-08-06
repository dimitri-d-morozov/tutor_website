"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { levelLabels, levelOptions } from "@/lib/labels";
import {
  addCourseTopic,
  createCourse,
  updateCourse,
} from "@/app/(tutor)/tutor/courses/actions";

export type CourseValues = { id: string; title: string; level: string };

function CourseModal({
  open,
  onClose,
  course,
}: {
  open: boolean;
  onClose: () => void;
  course?: CourseValues;
}) {
  const isEdit = course !== undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Изменить программу" : "Новая программа"}
    >
      <form
        action={isEdit ? updateCourse : createCourse}
        className="flex flex-col gap-4"
      >
        {isEdit && <input type="hidden" name="id" value={course.id} />}

        <Field label="Название">
          <Input
            name="title"
            required
            defaultValue={course?.title}
            placeholder="Например: ЕГЭ годовой"
          />
        </Field>

        <Field
          label="Уровень"
          hint="При создании ученика подставятся программы его уровня"
        >
          <Select name="level" defaultValue={course?.level ?? "ege"}>
            {levelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
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

export function NewCourseButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Новая программа</Button>
      <CourseModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function EditCourseButton({ course }: { course: CourseValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Изменить
      </Button>
      <CourseModal
        open={open}
        onClose={() => setOpen(false)}
        course={course}
      />
    </>
  );
}

/**
 * Добавление темы в программу: выбор темы + сколько занятий ей отвести.
 * Темы сгруппированы по отделам, а уровни показаны в подписи — так видно,
 * подходит ли тема уровню программы.
 */
export function AddCourseTopicButton({
  courseId,
  courseLevel,
  groups,
}: {
  courseId: string;
  courseLevel: string;
  groups: Array<{
    section: string;
    topics: Array<{ id: string; label: string; levels: string[] }>;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const total = groups.reduce((n, g) => n + g.topics.length, 0);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Добавить тему</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Добавить тему">
        {total === 0 ? (
          <p className="text-sm text-ink-soft">
            Свободных тем нет — все уже в программе. Создайте новую в разделе
            «Темы».
          </p>
        ) : (
          <form action={addCourseTopic} className="flex flex-col gap-4">
            <input type="hidden" name="course_id" value={courseId} />

            <Field label="Тема">
              <Select name="topic_id" required>
                {groups.map((g) => (
                  <optgroup key={g.section} label={g.section}>
                    {g.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                        {t.levels.includes(courseLevel)
                          ? ""
                          : ` — не помечена как ${levelLabels[courseLevel as keyof typeof levelLabels]}`}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>

            <Field
              label="Занятий по плану"
              hint="Сколько занятий обычно уходит на эту тему. У конкретного ученика можно изменить"
            >
              <Input
                type="number"
                name="planned_lessons"
                min={1}
                max={20}
                defaultValue={1}
              />
            </Field>

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
