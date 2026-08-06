"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type Level = Database["public"]["Enums"]["exam_type"];
type MaterialRole = Database["public"]["Enums"]["lesson_material_role"];

function optional(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Темы — единица плана. У темы есть отдел, уровни и содержимое (презентация,
 * доп. материалы, ДЗ-тесты). Сколько занятий уходит на тему — свойство ученика,
 * а не темы, поэтому здесь этого нет.
 */

export async function createTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const title = optional(formData.get("title"));
  if (!title) return;

  const sectionId = optional(formData.get("section_id"));
  const supabase = await createClient();

  // Порядок считаем внутри отдела: темы показываются сгруппированными по отделам.
  // Для тем без отдела нужен is(null) — eq на NULL ничего не находит.
  let lastQuery = supabase
    .from("topics")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  lastQuery = sectionId
    ? lastQuery.eq("section_id", sectionId)
    : lastQuery.is("section_id", null);
  const { data: last } = await lastQuery.maybeSingle();

  const { error } = await supabase.from("topics").insert({
    title,
    code: optional(formData.get("code")),
    section_id: sectionId,
    levels: formData.getAll("levels").map(String) as Level[],
    position: (last?.position ?? 0) + 1,
  });

  if (error) throw new Error(`Не удалось создать тему: ${error.message}`);
  revalidatePath("/tutor/topics");
}

export async function updateTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  const title = optional(formData.get("title"));
  if (!id || !title) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("topics")
    .update({
      title,
      code: optional(formData.get("code")),
      section_id: optional(formData.get("section_id")),
      levels: formData.getAll("levels").map(String) as Level[],
    })
    .eq("id", id);

  if (error) throw new Error(`Не удалось изменить тему: ${error.message}`);
  revalidatePath("/tutor/topics");
  revalidatePath(`/tutor/topics/${id}`);
}

/**
 * Удалить тему.
 *
 * У материалов, вопросов и тестов `topic_id` обнулится (on delete set null) —
 * контент не пропадёт. А вот занятия учеников по этой теме останутся с пустой
 * темой, поэтому предупреждаем в интерфейсе, если тема уже в чьём-то плане.
 */
export async function deleteTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw new Error(`Не удалось удалить тему: ${error.message}`);

  revalidatePath("/tutor/topics");
}

/** Поменять тему местами с соседней внутри её отдела. */
export async function moveTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const supabase = await createClient();
  const { data: topic } = await supabase
    .from("topics")
    .select("id, section_id")
    .eq("id", id)
    .maybeSingle();
  if (!topic) return;

  let query = supabase.from("topics").select("id, position").order("position");
  query = topic.section_id
    ? query.eq("section_id", topic.section_id)
    : query.is("section_id", null);
  const { data: siblings } = await query;
  if (!siblings) return;

  const index = siblings.findIndex((t) => t.id === id);
  const neighbour = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighbour < 0 || neighbour >= siblings.length) return;

  await Promise.all([
    supabase
      .from("topics")
      .update({ position: siblings[neighbour].position })
      .eq("id", siblings[index].id),
    supabase
      .from("topics")
      .update({ position: siblings[index].position })
      .eq("id", siblings[neighbour].id),
  ]);

  revalidatePath("/tutor/topics");
}

// ─── Содержимое темы ──────────────────────────────────────────────────────────

export async function attachTopicMaterial(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const topicId = optional(formData.get("topic_id"));
  const materialId = optional(formData.get("material_id"));
  if (!topicId || !materialId) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("topic_materials")
    .select("position")
    .eq("topic_id", topicId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("topic_materials").insert({
    topic_id: topicId,
    material_id: materialId,
    role: String(formData.get("role") ?? "extra") as MaterialRole,
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Этот материал уже прикреплён к теме"
        : `Не удалось прикрепить материал: ${error.message}`,
    );
  }

  revalidatePath(`/tutor/topics/${topicId}`);
}

export async function detachTopicMaterial(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const topicId = optional(formData.get("topic_id"));
  const materialId = optional(formData.get("material_id"));
  if (!topicId || !materialId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("topic_materials")
    .delete()
    .eq("topic_id", topicId)
    .eq("material_id", materialId);

  if (error) throw new Error(`Не удалось убрать материал: ${error.message}`);
  revalidatePath(`/tutor/topics/${topicId}`);
}

export async function attachTopicTest(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const topicId = optional(formData.get("topic_id"));
  const testId = optional(formData.get("test_template_id"));
  if (!topicId || !testId) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("topic_tests")
    .select("position")
    .eq("topic_id", topicId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("topic_tests").insert({
    topic_id: topicId,
    test_template_id: testId,
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Этот тест уже задан как ДЗ этой темы"
        : `Не удалось прикрепить тест: ${error.message}`,
    );
  }

  revalidatePath(`/tutor/topics/${topicId}`);
}

export async function detachTopicTest(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const topicId = optional(formData.get("topic_id"));
  const testId = optional(formData.get("test_template_id"));
  if (!topicId || !testId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("topic_tests")
    .delete()
    .eq("topic_id", topicId)
    .eq("test_template_id", testId);

  if (error) throw new Error(`Не удалось убрать тест: ${error.message}`);
  revalidatePath(`/tutor/topics/${topicId}`);
}

// ─── Отделы ───────────────────────────────────────────────────────────────────
// Переехали сюда со страницы материалов: отделы группируют темы, поэтому
// логичнее править их там же, где темы.

export async function createSection(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const title = optional(formData.get("title"));
  if (!title) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("sections")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("sections")
    .insert({ title, position: (last?.position ?? 0) + 1 });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? `Отдел «${title}» уже есть в списке`
        : `Не удалось добавить отдел: ${error.message}`,
    );
  }

  revalidatePath("/tutor/topics");
}

export async function renameSection(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  const title = optional(formData.get("title"));
  if (!id || !title) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sections")
    .update({ title })
    .eq("id", id);

  if (error) throw new Error(`Не удалось переименовать отдел: ${error.message}`);
  revalidatePath("/tutor/topics");
}

/**
 * Удалить отдел. У тем, материалов и тестов section_id обнулится
 * (on delete set null) — сам контент не пострадает, темы окажутся «без отдела».
 */
export async function deleteSection(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("sections").delete().eq("id", id);
  if (error) throw new Error(`Не удалось удалить отдел: ${error.message}`);

  revalidatePath("/tutor/topics");
}
