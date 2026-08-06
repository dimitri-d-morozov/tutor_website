"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  createSection,
  deleteSection,
  renameSection,
} from "@/app/(tutor)/tutor/topics/actions";

/**
 * Редактор списка отделов вместе с кнопкой, которая его открывает.
 *
 * Отделы — таблица, а не enum, именно чтобы список правился здесь, без миграций.
 * При удалении отдела темы и материалы не пропадают: section_id обнуляется
 * (on delete set null), темы попадают в группу «Без отдела».
 */
export function SectionsEditor({
  sections,
}: {
  sections: Array<{ id: string; title: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Отделы
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Отделы">
        <div className="flex flex-col gap-2">
          {sections.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <form
                action={renameSection}
                className="flex flex-1 items-center gap-2"
              >
                <input type="hidden" name="id" value={s.id} />
                <Input name="title" defaultValue={s.title} className="flex-1" />
                <Button type="submit" variant="ghost">
                  Сохранить
                </Button>
              </form>
              <form action={deleteSection}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="ghost" className="text-coral">
                  Удалить
                </Button>
              </form>
            </div>
          ))}

          <form
            action={createSection}
            className="mt-3 border-t border-border pt-4"
          >
            <Field label="Новый отдел">
              <div className="flex gap-2">
                <Input
                  name="title"
                  required
                  placeholder="Например: Микробиология"
                />
                <Button type="submit" variant="outline">
                  Добавить
                </Button>
              </div>
            </Field>
          </form>
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Закрыть
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
