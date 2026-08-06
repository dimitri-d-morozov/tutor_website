"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/types/database.types";

type ExamType = Database["public"]["Enums"]["exam_type"];
type MaterialRole = Database["public"]["Enums"]["lesson_material_role"];

export type StudentFormState = { error: string | null };

function optional(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Создать ученика: аккаунт + профиль + сгенерированный план на год.
 *
 * Аккаунт создаётся через Admin API (обычный signUp тут не подходит: он залогинил
 * бы репетитора под новым пользователем). Строку в profiles ставит триггер
 * on_auth_user_created, забирая имя из user_metadata.
 *
 * Сразу после создания вызываем generate_plan_for_student — это и есть «план
 * готов с момента регистрации»: по выбранной программе создаются занятия по всем
 * её темам, с датами по указанной периодичности.
 */
export async function createStudent(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  await requireRole("tutor");

  const fullName = optional(formData.get("full_name"));
  const email = optional(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Укажите имя ученика" };
  if (!email) return { error: "Укажите email — это логин ученика" };
  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов" };
  }

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    // Подтверждать почту незачем: аккаунт заводит репетитор, а не сам ученик.
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !created.user) {
    const message = authError?.message ?? "неизвестная ошибка";
    return {
      error: /already|exists|registered/i.test(message)
        ? `Ученик с email ${email} уже есть`
        : `Не удалось создать аккаунт: ${message}`,
    };
  }

  const studentId = created.user.id;
  const supabase = await createClient();
  const courseId = optional(formData.get("course_id"));

  const { error: profileError } = await supabase.from("student_profiles").insert({
    profile_id: studentId,
    exam_type: (formData.get("exam_type") as ExamType) ?? "ege",
    course_id: courseId,
    grade: optional(formData.get("grade")),
    phone: optional(formData.get("phone")),
    messenger: optional(formData.get("messenger")),
    parent_name: optional(formData.get("parent_name")),
    parent_phone: optional(formData.get("parent_phone")),
    tariff: optional(formData.get("tariff")),
  });

  if (profileError) {
    // Аккаунт уже создан — откатываем его, иначе останется пользователь,
    // которого не видно в списке учеников.
    await admin.auth.admin.deleteUser(studentId);
    return { error: `Не удалось сохранить данные ученика: ${profileError.message}` };
  }

  // Программа не выбрана — ученик создан, план соберём позже кнопкой в карточке.
  if (courseId) {
    const { error: planError } = await supabase.rpc(
      "generate_plan_for_student",
      {
        p_student: studentId,
        p_course: courseId,
        p_start: optional(formData.get("start_at")) ?? undefined,
        p_interval_days: Number(formData.get("interval_days") ?? 7),
      },
    );

    if (planError) {
      // План — не причина терять созданного ученика: сообщаем и оставляем как
      // есть, досоздать занятия можно кнопкой в карточке.
      revalidatePath("/tutor/students");
      return {
        error: `Ученик создан, но план не сформировался: ${planError.message}. Нажмите «Дополнить план по программе» в его карточке.`,
      };
    }
  }

  revalidatePath("/tutor/students");
  redirect(`/tutor/students/${studentId}`);
}

/** Контакты, тариф, класс, заметка. */
export async function updateStudent(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const fullName = optional(formData.get("full_name"));

  if (fullName) {
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", id);
  }

  const { error } = await supabase
    .from("student_profiles")
    .update({
      exam_type: (formData.get("exam_type") as ExamType) ?? "ege",
      course_id: optional(formData.get("course_id")),
      grade: optional(formData.get("grade")),
      phone: optional(formData.get("phone")),
      messenger: optional(formData.get("messenger")),
      parent_name: optional(formData.get("parent_name")),
      parent_phone: optional(formData.get("parent_phone")),
      tariff: optional(formData.get("tariff")),
      status: String(formData.get("status") ?? "active"),
      tutor_note: optional(formData.get("tutor_note")),
    })
    .eq("profile_id", id);

  if (error) throw new Error(`Не удалось сохранить: ${error.message}`);

  revalidatePath(`/tutor/students/${id}`);
  revalidatePath("/tutor/students");
}

/**
 * Дополнить план ученика по его программе.
 *
 * Нужна, когда программа пополнилась темами или у темы подняли плановое число
 * занятий. RPC идемпотентна: досоздаёт только недостающее, даты продолжает после
 * последнего занятия, правки и отметки «проведено» не трогает.
 */
export async function syncPlanWithCourse(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const id = optional(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("student_profiles")
    .select("course_id")
    .eq("profile_id", id)
    .maybeSingle();

  if (!profile?.course_id) {
    throw new Error(
      "У ученика не выбрана программа — укажите её в «Изменить данные»",
    );
  }

  const { error } = await supabase.rpc("generate_plan_for_student", {
    p_student: id,
    p_course: profile.course_id,
    p_start: optional(formData.get("start_at")) ?? undefined,
    p_interval_days: Number(formData.get("interval_days") ?? 7),
  });

  if (error) throw new Error(`Не удалось дополнить план: ${error.message}`);
  revalidatePath(`/tutor/students/${id}`);
}

// ─── Занятия ученика ──────────────────────────────────────────────────────────

/**
 * Отметить занятие проведённым с датой (или вернуть в «предстоит»).
 *
 * Это ключевое действие: именно оно открывает ученику материалы и ДЗ занятия
 * (политики slm_select / slt_select пускают только при status = 'completed').
 */
export async function setLessonStatus(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  if (!lessonId || !studentId) return;

  const completed = String(formData.get("completed") ?? "") === "true";
  const heldOn = optional(formData.get("held_on"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_lessons")
    .update({
      status: completed ? "completed" : "upcoming",
      // Дата проведённого занятия: если репетитор её указал — берём её,
      // иначе оставляем то, что было запланировано.
      ...(completed && heldOn ? { scheduled_at: heldOn } : {}),
    })
    .eq("id", lessonId);

  if (error) throw new Error(`Не удалось изменить занятие: ${error.message}`);
  revalidatePath(`/tutor/students/${studentId}`);
}

/** Дата, ссылка на созвон и заметка по занятию. */
export async function updateStudentLesson(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  if (!lessonId || !studentId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_lessons")
    .update({
      scheduled_at: optional(formData.get("scheduled_at")),
      meeting_url: optional(formData.get("meeting_url")),
      tutor_note: optional(formData.get("tutor_note")),
    })
    .eq("id", lessonId);

  if (error) throw new Error(`Не удалось сохранить занятие: ${error.message}`);
  revalidatePath(`/tutor/students/${studentId}`);
}

/**
 * Добавить ученику занятие по теме — вместе с материалами и ДЗ этой темы.
 *
 * Тот самый сценарий «этому ученику нужно больше времени на генетику»: одна тема
 * может занимать сколько угодно занятий, и это свойство ученика, а не программы.
 *
 * `copy_content` выключают, когда добавляют разбор или закрепление: материалы уже
 * лежат на первом занятии по теме, дублировать их во втором незачем.
 */
export async function addLessonForTopic(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const studentId = optional(formData.get("student_id"));
  const topicId = optional(formData.get("topic_id"));
  if (!studentId || !topicId) return;

  const supabase = await createClient();
  const copyContent = String(formData.get("copy_content") ?? "") === "true";

  const { data: last } = await supabase
    .from("student_lessons")
    .select("position, scheduled_at")
    .eq("student_id", studentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lesson, error } = await supabase
    .from("student_lessons")
    .insert({
      student_id: studentId,
      topic_id: topicId,
      title: optional(formData.get("title")),
      position: (last?.position ?? 0) + 1,
      scheduled_at: optional(formData.get("scheduled_at")),
      status: "upcoming",
    })
    .select("id")
    .single();

  if (error || !lesson) {
    throw new Error(`Не удалось добавить занятие: ${error?.message ?? ""}`);
  }

  if (copyContent) {
    const [{ data: topicMaterials }, { data: topicTests }] = await Promise.all([
      supabase
        .from("topic_materials")
        .select("material_id, role, position")
        .eq("topic_id", topicId),
      supabase
        .from("topic_tests")
        .select("test_template_id, position")
        .eq("topic_id", topicId),
    ]);

    if (topicMaterials?.length) {
      await supabase.from("student_lesson_materials").insert(
        topicMaterials.map((m) => ({
          student_lesson_id: lesson.id,
          material_id: m.material_id,
          role: m.role,
          position: m.position,
        })),
      );
    }

    if (topicTests?.length) {
      await supabase.from("student_lesson_tests").insert(
        topicTests.map((t) => ({
          student_lesson_id: lesson.id,
          test_template_id: t.test_template_id,
          position: t.position,
        })),
      );
    }
  }

  revalidatePath(`/tutor/students/${studentId}`);
}

/**
 * Поменять занятие местами с соседним. Порядок занятий — это последовательность
 * прохождения тем, поэтому он стал значимым: новые занятия RPC дописывает
 * в конец, и иногда их нужно поднять на своё место в программе.
 */
export async function moveStudentLesson(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const studentId = optional(formData.get("student_id"));
  const lessonId = optional(formData.get("lesson_id"));
  const direction = String(formData.get("direction") ?? "");
  if (!studentId || !lessonId) return;
  if (direction !== "up" && direction !== "down") return;

  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("student_lessons")
    .select("id, position")
    .eq("student_id", studentId)
    .order("position");

  if (!lessons) return;
  const index = lessons.findIndex((l) => l.id === lessonId);
  const neighbour = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighbour < 0 || neighbour >= lessons.length) return;

  await Promise.all([
    supabase
      .from("student_lessons")
      .update({ position: lessons[neighbour].position })
      .eq("id", lessons[index].id),
    supabase
      .from("student_lessons")
      .update({ position: lessons[index].position })
      .eq("id", lessons[neighbour].id),
  ]);

  revalidatePath(`/tutor/students/${studentId}`);
}

export async function removeStudentLesson(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  if (!lessonId || !studentId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_lessons")
    .delete()
    .eq("id", lessonId);

  if (error) throw new Error(`Не удалось удалить занятие: ${error.message}`);
  revalidatePath(`/tutor/students/${studentId}`);
}

// ─── Индивидуальный состав занятия ────────────────────────────────────────────
// Ровно та гибкость, которую просил заказчик: план приходит из шаблона, но
// конкретному занятию конкретного ученика можно добавить своё — разбор его
// ошибок, отдельное ДЗ — не плодя копии шаблона.

export async function attachStudentMaterial(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  const materialId = optional(formData.get("material_id"));
  if (!lessonId || !studentId || !materialId) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("student_lesson_materials")
    .select("position")
    .eq("student_lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("student_lesson_materials").insert({
    student_lesson_id: lessonId,
    material_id: materialId,
    role: (String(formData.get("role") ?? "extra") as MaterialRole),
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Этот материал уже прикреплён к занятию"
        : `Не удалось прикрепить материал: ${error.message}`,
    );
  }

  revalidatePath(`/tutor/students/${studentId}`);
}

export async function detachStudentMaterial(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  const materialId = optional(formData.get("material_id"));
  if (!lessonId || !studentId || !materialId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_lesson_materials")
    .delete()
    .eq("student_lesson_id", lessonId)
    .eq("material_id", materialId);

  if (error) throw new Error(`Не удалось убрать материал: ${error.message}`);
  revalidatePath(`/tutor/students/${studentId}`);
}

export async function attachStudentTest(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  const testId = optional(formData.get("test_template_id"));
  if (!lessonId || !studentId || !testId) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("student_lesson_tests")
    .select("position")
    .eq("student_lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("student_lesson_tests").insert({
    student_lesson_id: lessonId,
    test_template_id: testId,
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Этот тест уже задан как ДЗ этого занятия"
        : `Не удалось задать тест: ${error.message}`,
    );
  }

  revalidatePath(`/tutor/students/${studentId}`);
}

export async function detachStudentTest(formData: FormData): Promise<void> {
  await requireRole("tutor");
  const lessonId = optional(formData.get("lesson_id"));
  const studentId = optional(formData.get("student_id"));
  const testId = optional(formData.get("test_template_id"));
  if (!lessonId || !studentId || !testId) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_lesson_tests")
    .delete()
    .eq("student_lesson_id", lessonId)
    .eq("test_template_id", testId);

  if (error) throw new Error(`Не удалось убрать тест: ${error.message}`);
  revalidatePath(`/tutor/students/${studentId}`);
}
