"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/labels";
import {
  finishTest,
  saveAnswer,
} from "@/app/(student)/student/tests/actions";

export type RunnerQuestion = {
  questionId: string;
  position: number;
  text: string;
  type: "single_choice" | "open";
  maxPoints: number;
  options: Array<{ id: string; text: string }>;
  /** Уже сохранённый ответ — чтобы вернуться и продолжить. */
  savedAnswer: string | null;
};

/** «14:32» из числа секунд. */
function formatLeft(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Прохождение теста: один вопрос на экран.
 *
 * Ответ сохраняется на сервере при переходе к следующему вопросу, а не в конце:
 * если браузер закроется, прогресс останется. Таймер здесь только показывает
 * время — настоящее ограничение стоит в БД (`save_answer` отказывает после
 * истечения лимита), поэтому «подкрутить» его из консоли бесполезно.
 */
export function TestRunner({
  attemptId,
  title,
  questions,
  deadline,
}: {
  attemptId: string;
  title: string;
  questions: RunnerQuestion[];
  /** ISO-время, когда истекает лимит; null — тест без таймера. */
  deadline: string | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions
        .filter((q) => q.savedAnswer !== null)
        .map((q) => [q.questionId, q.savedAnswer as string]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Секунды до конца лимита; отрицательные — на сколько уже просрочено. */
  const [left, setLeft] = useState<number | null>(null);

  const current = questions[index];
  const answered = Object.keys(answers).length;

  // Таймер считается от серверного deadline, а не от «лимит минут с момента
  // открытия страницы»: перезагрузка не должна дарить дополнительное время.
  //
  // По нулю НИЧЕГО не происходит: лимит — ориентир, а не блокировка. Ответы
  // продолжают сохраняться, а превышение репетитор увидит в разборе попытки
  // (считается из дат, см. lib/tests/attempt.ts).
  useEffect(() => {
    if (!deadline) return;
    const end = new Date(deadline).getTime();

    const tick = () => setLeft(Math.round((end - Date.now()) / 1000));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  async function persist(questionId: string, value: string) {
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("attempt_id", attemptId);
      form.set("question_id", questionId);
      form.set("answer", value);
      await saveAnswer(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить ответ");
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    const value = answers[current.questionId];
    if (value !== undefined && value !== "") {
      await persist(current.questionId, value);
    }
    if (index < questions.length - 1) setIndex(index + 1);
    else router.refresh();
  }

  if (!current) return null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl">{title}</h1>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {left !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold",
              left <= 0
                ? "bg-coral-100 text-coral"
                : left <= 60
                  ? "bg-amber-200 text-amber-600"
                  : "bg-surface-muted text-ink-soft",
            )}
          >
            {left <= 0
              ? `⏱ время вышло: +${formatLeft(-left)}`
              : `⏱ ${formatLeft(left)} осталось`}
          </span>
        )}
        <span className="text-xs text-ink-faint">
          отвечено {answered} из {questions.length}
        </span>
        {saving && <span className="text-xs text-ink-faint">сохраняем…</span>}
      </div>

      {left !== null && left <= 0 && (
        <p className="mb-4 rounded-sm bg-coral-100 px-3 py-2 text-sm text-coral">
          Время вышло, но тест не закрыт — можно спокойно закончить. Репетитор
          увидит, что вы не уложились в лимит.
        </p>
      )}

      <Card>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-faint">
          <span>
            Вопрос {index + 1} из {questions.length}
          </span>
          <Tag tone={current.type === "open" ? "coral" : "green"}>
            {current.type === "open" ? "Развёрнутый" : "Один ответ"}
          </Tag>
          <span>
            {current.maxPoints}{" "}
            {plural(current.maxPoints, "балл", "балла", "баллов")}
          </span>
        </div>

        <div className="mb-5 font-display text-xl leading-snug">
          {current.text}
        </div>

        {current.type === "single_choice" ? (
          <div className="flex flex-col gap-2.5">
            {current.options.map((o) => {
              const chosen = answers[current.questionId] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [current.questionId]: o.id,
                    }))
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-4 py-3.5 text-left text-sm transition-colors",
                    chosen
                      ? "border-green-500 bg-green-100"
                      : "border-border hover:border-green-500 hover:bg-green-100",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 flex-none rounded-full border-2",
                      chosen ? "border-green-700 bg-green-700" : "border-border",
                    )}
                  />
                  {o.text}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <Textarea
              rows={6}
              value={answers[current.questionId] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [current.questionId]: e.target.value,
                }))
              }
              placeholder="Развёрнутый ответ своими словами"
            />
            <p className="mt-2 text-xs text-ink-faint">
              Этот ответ проверит репетитор и поставит от 0 до{" "}
              {current.maxPoints}{" "}
              {plural(current.maxPoints, "балла", "баллов", "баллов")}.
            </p>
          </>
        )}

        {error && <p className="mt-3 text-sm text-coral">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            ← Назад
          </Button>

          <div className="flex items-center gap-2">
            {index < questions.length - 1 ? (
              <Button type="button" onClick={goNext} disabled={saving}>
                Следующий вопрос
              </Button>
            ) : (
              /*
               * Обычная форма без обработчиков. Последний ответ едет скрытыми
               * полями, и сохраняет его сама finishTest — раньше это делалось
               * в onSubmit через preventDefault + requestSubmit, что вызывало
               * тот же обработчик заново и вешало страницу.
               */
              <form action={finishTest}>
                <input type="hidden" name="attempt_id" value={attemptId} />
                <input
                  type="hidden"
                  name="question_id"
                  value={current.questionId}
                />
                <input
                  type="hidden"
                  name="answer"
                  value={answers[current.questionId] ?? ""}
                />
                <Button type="submit" disabled={saving}>
                  Сдать тест
                </Button>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* Навигация по номерам: видно, что осталось без ответа. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const done = answers[q.questionId] !== undefined && answers[q.questionId] !== "";
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "h-8 w-8 rounded-sm border text-xs font-medium",
                i === index
                  ? "border-green-700 bg-green-700 text-white"
                  : done
                    ? "border-green-500 bg-green-100 text-green-700"
                    : "border-border bg-surface text-ink-faint",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
