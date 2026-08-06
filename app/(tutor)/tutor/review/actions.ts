"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Проверить развёрнутый ответ: балл и комментарий.
 *
 * Вся логика в RPC `review_answer`: она проверяет роль, диапазон балла, ставит
 * `is_correct` и — когда непроверенных ответов в попытке больше не осталось —
 * пересчитывает итоговый балл и закрывает попытку. Держать это в приложении
 * значило бы дублировать пересчёт в каждом вызывающем месте.
 */
export async function reviewAnswer(formData: FormData): Promise<void> {
  await requireRole("tutor");

  const answerId = String(formData.get("answer_id") ?? "");
  if (!answerId) return;

  const points = Number(formData.get("points") ?? 0);
  if (!Number.isFinite(points)) {
    throw new Error("Балл должен быть числом");
  }

  const comment = String(formData.get("comment") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_answer", {
    p_answer: answerId,
    p_points: points,
    p_comment: comment === "" ? undefined : comment,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/tutor/review");
  // "layout" — чтобы обновились и вложенные страницы разбора попытки:
  // балл меняется как в очереди, так и в карточке ученика.
  revalidatePath("/tutor/students", "layout");
}
