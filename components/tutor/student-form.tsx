"use client";

import { useActionState, useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createStudent,
  resetStudentPassword,
  updateStudent,
  type PasswordResetState,
  type StudentFormState,
} from "@/app/(tutor)/tutor/students/actions";
import { examTypeLabels } from "@/lib/labels";

const initial: StudentFormState = { error: null };

const examOptions = Object.entries(examTypeLabels);

export type Course = {
  id: string;
  title: string;
  level: string;
  /** Сколько занятий даёт программа — показываем только при создании ученика. */
  lessons?: number;
};

/** Варианты периодичности занятий для генерации расписания. */
const intervalOptions = [
  { value: "7", label: "раз в неделю" },
  { value: "3", label: "дважды в неделю" },
  { value: "14", label: "раз в две недели" },
];

/**
 * Создание ученика.
 *
 * Пароль задаёт репетитор и передаёт ученику сам — почтовой рассылки в MVP нет,
 * а ученики появляются по одному, так что это дешевле и понятнее, чем инвайты.
 *
 * Программа и расписание — здесь же: сразу после создания генерируется план на
 * год, чтобы репетитору не пришлось собирать его вручную.
 */
export function NewStudentButton({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createStudent, initial);
  const [exam, setExam] = useState("ege");

  // Показываем только программы выбранного уровня — иначе легко записать
  // одиннадцатиклассника на ОГЭ-программу.
  const available = courses.filter((c) => c.level === exam);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Новый ученик</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Новый ученик"
        className="w-[520px]"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Имя и фамилия">
            <Input name="full_name" required placeholder="Аня Смирнова" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email (логин)">
              <Input
                name="email"
                type="email"
                required
                placeholder="anya@example.com"
              />
            </Field>
            <Field label="Пароль" hint="Передайте ученику лично">
              <Input
                name="password"
                type="text"
                required
                minLength={6}
                placeholder="минимум 6 символов"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Экзамен">
              <Select
                name="exam_type"
                value={exam}
                onChange={(e) => setExam(e.target.value)}
              >
                {examOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Класс">
              <Input name="grade" placeholder="11 класс" />
            </Field>
          </div>

          {/* ─── Программа и расписание ─── */}
          <div className="rounded-md bg-surface-muted p-3">
            <Field
              label="Программа подготовки"
              hint={
                available.length === 0
                  ? "Для этого уровня программ пока нет — создайте её в разделе «Программы». Ученика можно завести и без плана."
                  : "План на весь курс создастся автоматически"
              }
              className="mb-3"
            >
              <Select name="course_id" defaultValue="">
                <option value="">— без плана —</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.lessons ? ` · ${c.lessons} занятий` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Первое занятие">
                <Input type="datetime-local" name="start_at" />
              </Field>
              <Field label="Периодичность">
                <Select name="interval_days" defaultValue="7">
                  {intervalOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Телефон">
              <Input name="phone" placeholder="+7 900 000-00-00" />
            </Field>
            <Field label="Мессенджер">
              <Input name="messenger" placeholder="@nickname" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Родитель">
              <Input name="parent_name" placeholder="Ольга Смирнова" />
            </Field>
            <Field label="Телефон родителя">
              <Input name="parent_phone" placeholder="+7 900 000-00-00" />
            </Field>
          </div>

          <Field label="Тариф">
            <Input name="tariff" placeholder="8 занятий / месяц" />
          </Field>

          {state.error && <p className="text-sm text-coral">{state.error}</p>}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Создаём…" : "Создать ученика"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

const initialReset: PasswordResetState = { error: null, done: false };

/**
 * Смена пароля ученику.
 *
 * Пароль задаёт репетитор и диктует ученику — тот же путь, что при создании
 * аккаунта: писем система не шлёт. Старый пароль не показываем и показать не
 * можем — в базе только его хеш.
 */
export function ResetPasswordButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Сменить пароль
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый пароль">
        {/* Форма монтируется заново при каждом открытии: useActionState живёт
            столько же, сколько компонент, и без этого «Пароль изменён» от
            прошлого раза висел бы в свежем окне как будто это новый результат. */}
        {open && (
          <ResetPasswordForm
            studentId={studentId}
            studentName={studentName}
            onClose={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function ResetPasswordForm({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    resetStudentPassword,
    initialReset,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={studentId} />

      <p className="text-sm text-ink-soft">
        Новый пароль для{" "}
        <span className="font-medium text-ink">{studentName}</span>. Старый
        посмотреть нельзя — в базе хранится только его хеш.
      </p>

      <Field
        label="Пароль"
        hint="Продиктуйте ученику: писем система не отправляет"
      >
        <Input
          name="password"
          // type="text", а не "password": репетитор диктует пароль вслух,
          // и ему нужно видеть, что он набрал.
          type="text"
          required
          minLength={6}
          placeholder="минимум 6 символов"
        />
      </Field>

      {state.error && <p className="text-sm text-coral">{state.error}</p>}
      {state.done && (
        <p className="rounded-sm bg-green-100 px-3 py-2 text-sm text-green-700">
          Пароль изменён. Старый больше не работает — передайте ученику новый.
        </p>
      )}

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {state.done ? "Закрыть" : "Отмена"}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Меняем…" : "Сменить пароль"}
        </Button>
      </ModalFooter>
    </form>
  );
}

export type StudentDetails = {
  id: string;
  full_name: string;
  exam_type: string;
  course_id: string | null;
  grade: string | null;
  phone: string | null;
  messenger: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  tariff: string | null;
  status: string;
  tutor_note: string | null;
};

/** Правка контактов, программы, тарифа и заметки в карточке ученика. */
export function EditStudentButton({
  student,
  courses,
}: {
  student: StudentDetails;
  courses: Course[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Изменить данные
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Данные ученика"
        className="w-[520px]"
      >
        <form action={updateStudent} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={student.id} />

          <Field label="Имя и фамилия">
            <Input name="full_name" required defaultValue={student.full_name} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Экзамен">
              <Select name="exam_type" defaultValue={student.exam_type}>
                {examOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Класс">
              <Input name="grade" defaultValue={student.grade ?? ""} />
            </Field>
            <Field label="Статус">
              <Select name="status" defaultValue={student.status}>
                <option value="active">Занимается</option>
                <option value="paused">Приостановлено</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Программа подготовки"
            hint="Смена программы не переписывает уже созданные занятия — новые темы добавит «Дополнить план по программе»"
          >
            <Select name="course_id" defaultValue={student.course_id ?? ""}>
              <option value="">— не выбрана —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} · {examTypeLabels[c.level as "ege"]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Телефон">
              <Input name="phone" defaultValue={student.phone ?? ""} />
            </Field>
            <Field label="Мессенджер">
              <Input name="messenger" defaultValue={student.messenger ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Родитель">
              <Input
                name="parent_name"
                defaultValue={student.parent_name ?? ""}
              />
            </Field>
            <Field label="Телефон родителя">
              <Input
                name="parent_phone"
                defaultValue={student.parent_phone ?? ""}
              />
            </Field>
          </div>

          <Field label="Тариф">
            <Input name="tariff" defaultValue={student.tariff ?? ""} />
          </Field>

          <Field label="Заметка" hint="Видна только вам">
            <Textarea
              name="tutor_note"
              rows={3}
              defaultValue={student.tutor_note ?? ""}
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
              Сохранить
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
