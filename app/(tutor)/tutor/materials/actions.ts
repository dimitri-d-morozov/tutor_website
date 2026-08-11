"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MATERIALS_BUCKET, MAX_FILE_SIZE } from "@/lib/materials";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type MaterialType = Database["public"]["Enums"]["material_type"];
type Level = Database["public"]["Enums"]["exam_type"];

export type FormState = { error: string | null; ok?: boolean };

/** Пустая строка из формы должна стать NULL, а не ''. */
function optional(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Добавить материал: либо файл в Storage, либо внешняя ссылка — ровно одно из двух
 * (в БД это гарантирует constraint materials_source_check).
 *
 * Порядок для файлового варианта: сначала строка в БД (чтобы получить id для пути),
 * потом загрузка файла, потом storage_path. Если загрузка упала — строку удаляем,
 * иначе в библиотеке останется материал, который нечем открыть.
 */
export async function createMaterial(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("tutor");
  const supabase = await createClient();

  const title = optional(formData.get("title"));
  if (!title) return { error: "Укажите название материала" };

  const source = String(formData.get("source") ?? "file");
  const type = String(formData.get("type") ?? "other") as MaterialType;
  const levels = formData.getAll("levels").map(String) as Level[];
  const file = formData.get("file");

  const base = {
    title,
    type,
    levels,
    topic_id: optional(formData.get("topic_id")),
    section_id: optional(formData.get("section_id")),
    description: optional(formData.get("description")),
  };

  // ─── Вариант «ссылка» ──────────────────────────────────────────────────────
  if (source === "link") {
    const url = optional(formData.get("external_url"));
    if (!url) return { error: "Укажите ссылку на материал" };
    if (!/^https?:\/\//i.test(url)) {
      return { error: "Ссылка должна начинаться с http:// или https://" };
    }

    const { error } = await supabase
      .from("materials")
      .insert({ ...base, external_url: url });

    if (error) return { error: `Не удалось сохранить материал: ${error.message}` };

    revalidatePath("/tutor/materials");
    return { error: null, ok: true };
  }

  // ─── Вариант «файл» ────────────────────────────────────────────────────────
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл или переключитесь на добавление ссылкой" };
  }
  // Клиентская проверка размера — только для удобства, доверять ей нельзя.
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: `Файл больше 50 МБ. Загрузите файл меньшего размера или добавьте его ссылкой.`,
    };
  }

  // storage_path заполним после загрузки, поэтому временно кладём заглушку:
  // constraint требует, чтобы ровно один источник был не NULL.
  const { data: created, error: insertError } = await supabase
    .from("materials")
    .insert({ ...base, storage_path: "pending" })
    .select("id")
    .single();

  if (insertError || !created) {
    return {
      error: `Не удалось сохранить материал: ${insertError?.message ?? "неизвестная ошибка"}`,
    };
  }

  // Сохраняем файл с безопасным именем (только расширение от оригинала)
  // чтобы избежать проблем с кириллицей и спецсимволами в Supabase Storage
  const ext = file.name.split('.').pop() || 'bin';
  const safeName = `${created.id}.${ext}`;
  const path = `${created.id}/${safeName}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(MATERIALS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (uploadError) {
    // Откатываем строку — иначе в библиотеке останется битый материал.
    await supabase.from("materials").delete().eq("id", created.id);
    return { error: `Не удалось загрузить файл: ${uploadError.message}` };
  }

  const { error: updateError } = await supabase
    .from("materials")
    .update({
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
    })
    .eq("id", created.id);

  if (updateError) {
    await admin.storage.from(MATERIALS_BUCKET).remove([path]);
    await supabase.from("materials").delete().eq("id", created.id);
    return { error: `Не удалось сохранить материал: ${updateError.message}` };
  }

  revalidatePath("/tutor/materials");
  return { error: null, ok: true };
}

/** Изменить описательную часть материала. Сам файл не заменяем. */
export async function updateMaterial(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("tutor");
  const supabase = await createClient();

  const id = optional(formData.get("id"));
  const title = optional(formData.get("title"));
  if (!id) return { error: "Не передан идентификатор материала" };
  if (!title) return { error: "Укажите название материала" };

  const { error } = await supabase
    .from("materials")
    .update({
      title,
      type: String(formData.get("type") ?? "other") as MaterialType,
      levels: formData.getAll("levels").map(String) as Level[],
      topic_id: optional(formData.get("topic_id")),
      section_id: optional(formData.get("section_id")),
      description: optional(formData.get("description")),
    })
    .eq("id", id);

  if (error) return { error: `Не удалось изменить материал: ${error.message}` };

  revalidatePath("/tutor/materials");
  return { error: null, ok: true };
}

/** Удалить материал вместе с файлом. */
export async function deleteMaterial(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: material } = await supabase
    .from("materials")
    .select("storage_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw new Error(`Не удалось удалить материал: ${error.message}`);

  // Файл убираем после успешного удаления строки: осиротевший файл в бакете
  // безвреден, а вот строка без файла ломала бы скачивание.
  if (material?.storage_path && material.storage_path !== "pending") {
    await createAdminClient()
      .storage.from(MATERIALS_BUCKET)
      .remove([material.storage_path]);
  }

  revalidatePath("/tutor/materials");
}

// Отделы редактируются в разделе «Темы» — см. app/(tutor)/tutor/topics/actions.ts:
// отделы группируют темы, поэтому правятся там же, где темы.
