"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  CheckboxGroup,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { MAX_FILE_SIZE } from "@/lib/materials";
import { levelOptions, materialTypeOptions } from "@/lib/labels";
import {
  createMaterial,
  updateMaterial,
  type FormState,
} from "@/app/(tutor)/tutor/materials/actions";

export type MaterialFormValues = {
  id: string;
  title: string;
  type: string;
  levels: string[];
  topic_id: string | null;
  section_id: string | null;
  description: string | null;
  /** Есть ли у материала файл — если да, источник менять нельзя. */
  hasFile: boolean;
};

const initialState: FormState = { error: null };

/**
 * Форма материала: добавление (файл или ссылка) и правка описательной части.
 *
 * При правке источник (файл/ссылка) не меняем — это была бы отдельная операция
 * с перезагрузкой файла и чисткой старого. Нужно заменить файл — удалите материал
 * и загрузите заново.
 */
export function MaterialForm({
  open,
  onClose,
  sections,
  topics,
  material,
}: {
  open: boolean;
  onClose: () => void;
  sections: Array<{ id: string; title: string }>;
  topics: Array<{ id: string; title: string; code: string | null }>;
  material?: MaterialFormValues;
}) {
  const isEdit = material !== undefined;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateMaterial : createMaterial,
    initialState,
  );
  const [source, setSource] = useState<"file" | "link">("file");

  // Действие завершилось успехом — закрываем модалку.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Изменить материал" : "Добавить материал"}
    >
      <form action={formAction} className="flex flex-col gap-4">
        {isEdit && <input type="hidden" name="id" value={material.id} />}

        <Field label="Название">
          <Input
            name="title"
            required
            defaultValue={material?.title}
            placeholder="Например: Законы Менделя"
          />
        </Field>

        <Field label="Тип материала">
          <Select name="type" defaultValue={material?.type ?? "presentation"}>
            {materialTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Отдел">
          <Select name="section_id" defaultValue={material?.section_id ?? ""}>
            <option value="">— не указан —</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Уровень" hint="Можно отметить несколько">
          <CheckboxGroup
            name="levels"
            options={levelOptions}
            selected={material?.levels}
          />
        </Field>

        <Field label="Тема" hint="У материалов необязательна">
          <Select name="topic_id" defaultValue={material?.topic_id ?? ""}>
            <option value="">— не указана —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code ? `${t.code} · ${t.title}` : t.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Короткое описание">
          <Textarea
            name="description"
            rows={2}
            defaultValue={material?.description ?? ""}
            placeholder="Пара предложений — что внутри"
          />
        </Field>

        {!isEdit && (
          <Field label="Источник">
            <div className="mb-3 flex gap-2">
              <Button
                type="button"
                variant={source === "file" ? "amber" : "outline"}
                onClick={() => setSource("file")}
              >
                Файл
              </Button>
              <Button
                type="button"
                variant={source === "link" ? "amber" : "outline"}
                onClick={() => setSource("link")}
              >
                Ссылка
              </Button>
            </div>
            <input type="hidden" name="source" value={source} />

            {source === "file" ? (
              <FileInput name="file" maxSize={MAX_FILE_SIZE} required />
            ) : (
              <Input
                name="external_url"
                type="url"
                required
                placeholder="https://youtube.com/… или ссылка на облако"
              />
            )}
          </Field>
        )}

        {state.error && <p className="text-sm text-coral">{state.error}</p>}

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
