"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type Level = Database["public"]["Enums"]["exam_type"];

function optional(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Программа подготовки — упорядоченный список тем под уровень, с плановым числом
 * занятий на каждую тему. Именно из неё генерируется план ученика на год.
 *
 * Программ на один уровень может быть несколько («ЕГЭ годовой» и «ЕГЭ интенсив
 * с января»): они отличаются составом и темпом, но обе про ЕГЭ.
 */

export async function createCourse(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const title = optional(formData.get("title"));
  if (!title) return;

  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert({
    title,
    level: (formData.get("level") as Level) ?? "ege",
  });

  if (error) throw new Error(`Не удалось создать программу: ${error.message}`);
  revalidatePath("/tutor/courses");
}

export async function updateCourse(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  const title = optional(formData.get("title"));
  if (!id || !title) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ title, level: (formData.get("level") as Level) ?? "ege" })
    .eq("id", id);

  if (error) throw new Error(`Не удалось изменить программу: ${error.message}`);
  revalidatePath("/tutor/courses");
  revalidatePath(`/tutor/courses/${id}`);
}

/**
 * Удалить программу. Планы учеников не пострадают: занятия ссылаются на темы,
 * а не на программу, а `student_profiles.course_id` обнулится.
 */
export async function deleteCourse(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw new Error(`Не удалось удалить программу: ${error.message}`);

  revalidatePath("/tutor/courses");
}

// ─── Темы программы ───────────────────────────────────────────────────────────

export async function addCourseTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const courseId = optional(formData.get("course_id"));
  const topicId = optional(formData.get("topic_id"));
  if (!courseId || !topicId) return;

  const planned = Number(formData.get("planned_lessons") ?? 1);
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("course_topics")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("course_topics").insert({
    course_id: courseId,
    topic_id: topicId,
    position: (last?.position ?? 0) + 1,
    planned_lessons: Number.isFinite(planned)
      ? Math.min(Math.max(planned, 1), 20)
      : 1,
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Эта тема уже есть в программе"
        : `Не удалось добавить тему: ${error.message}`,
    );
  }

  revalidatePath(`/tutor/courses/${courseId}`);
}

/** Изменить число занятий, отводимых теме по плану. */
export async function setPlannedLessons(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const courseId = optional(formData.get("course_id"));
  const topicId = optional(formData.get("topic_id"));
  if (!courseId || !topicId) return;

  const planned = Number(formData.get("planned_lessons") ?? 1);
  if (!Number.isFinite(planned)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("course_topics")
    .update({ planned_lessons: Math.min(Math.max(planned, 1), 20) })
    .eq("course_id", courseId)
    .eq("topic_id", topicId);

  if (error) throw new Error(`Не удалось сохранить: ${error.message}`);
  revalidatePath(`/tutor/courses/${courseId}`);
}

export async function removeCourseTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const courseId = optional(formData.get("course_id"));
  const topicId = optional(formData.get("topic_id"));
  if (!courseId || !topicId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("course_topics")
    .delete()
    .eq("course_id", courseId)
    .eq("topic_id", topicId);

  if (error) throw new Error(`Не удалось убрать тему: ${error.message}`);
  revalidatePath(`/tutor/courses/${courseId}`);
}

/**
 * Поменять тему местами с соседней. Порядок тем в программе — это
 * последовательность прохождения курса, поэтому им управляют вручную.
 */
export async function moveCourseTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const courseId = optional(formData.get("course_id"));
  const topicId = optional(formData.get("topic_id"));
  const direction = String(formData.get("direction") ?? "");
  if (!courseId || !topicId) return;
  if (direction !== "up" && direction !== "down") return;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("course_topics")
    .select("topic_id, position")
    .eq("course_id", courseId)
    .order("position");

  if (!rows) return;
  const index = rows.findIndex((r) => r.topic_id === topicId);
  const neighbour = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighbour < 0 || neighbour >= rows.length) return;

  await Promise.all([
    supabase
      .from("course_topics")
      .update({ position: rows[neighbour].position })
      .eq("course_id", courseId)
      .eq("topic_id", rows[index].topic_id),
    supabase
      .from("course_topics")
      .update({ position: rows[index].position })
      .eq("course_id", courseId)
      .eq("topic_id", rows[neighbour].topic_id),
  ]);

  revalidatePath(`/tutor/courses/${courseId}`);
}
