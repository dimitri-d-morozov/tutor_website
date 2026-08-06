"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import {
  analyzeTest,
  saveTest,
  type ImportState,
} from "@/app/(tutor)/tutor/bank/actions";
import { optionLetter } from "@/lib/tests/format";
import { levelLabels, plural, questionTypeLabels } from "@/lib/labels";

const initial: ImportState = { errors: [] };

/**
 * Импорт теста из JSON-файла: выбрали файл → превью → сохранение.
 *
 * Разбор и сохранение — два разных действия. Между ними проверенный текст файла
 * лежит в скрытом поле, поэтому файл не нужно выбирать заново; на сохранении он
 * валидируется повторно, так как скрытому полю доверять нельзя.
 */
export function TestImport() {
  const [analyzeState, analyzeAction, analyzing] = useActionState(
    analyzeTest,
    initial,
  );
  const [saveState, saveAction, saving] = useActionState(saveTest, initial);

  const preview = analyzeState.preview;
  const errors =
    saveState.errors.length > 0 ? saveState.errors : analyzeState.errors;

  return (
    <div>
      <Link
        href="/tutor/bank"
        className="mb-5 inline-block text-[13px] font-medium text-green-700 hover:underline"
      >
        ← К вопросам и тестам
      </Link>

      <h1 className="mb-1 font-display text-3xl">Загрузить тест</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Файл в формате JSON. Описание формата и пример —{" "}
        <span className="font-medium">docs/test-format.md</span>: приложите его к
        чату с Клодом и попросите сгенерировать тест по нужной теме.
      </p>

      <Card>
        <form action={analyzeAction} className="flex items-end gap-3">
          <Field label="Файл теста" className="flex-1">
            <input
              type="file"
              name="file"
              accept=".json,application/json"
              required
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm"
            />
          </Field>
          <Button type="submit" variant="outline" disabled={analyzing}>
            {analyzing ? "Проверяем…" : "Проверить файл"}
          </Button>
        </form>
      </Card>

      {errors.length > 0 && (
        <Card className="mt-4 border-coral bg-coral-100">
          <CardTitle className="text-coral">
            {errors.length === 1
              ? "Файл не подходит"
              : `Нашли ${errors.length} ${plural(errors.length, "проблему", "проблемы", "проблем")}`}
          </CardTitle>
          <ul className="flex flex-col gap-1.5">
            {errors.map((e, i) => (
              <li key={i} className="text-sm text-coral">
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            В банк ничего не сохранено. Поправьте файл и загрузите снова.
          </p>
        </Card>
      )}

      {preview && (
        <>
          <Card className="mt-4">
            <CardTitle>Превью — проверьте перед сохранением</CardTitle>
            <h2 className="mb-2 font-display text-2xl">
              {preview.file.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <Tag>{preview.topicTitle}</Tag>
              {preview.sectionTitle && (
                <Tag tone="green">{preview.sectionTitle}</Tag>
              )}
              {preview.file.levels.map((l) => (
                <Tag key={l} tone="amber">
                  {levelLabels[l]}
                </Tag>
              ))}
              <span>
                {preview.file.questions.length}{" "}
                {plural(
                  preview.file.questions.length,
                  "вопрос",
                  "вопроса",
                  "вопросов",
                )}
              </span>
              {preview.file.time_limit_min && (
                <span>· {preview.file.time_limit_min} мин</span>
              )}
            </div>
          </Card>

          <div className="mt-4 flex flex-col gap-3">
            {preview.file.questions.map((q, i) => (
              <Card key={i}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-ink-faint">
                    Вопрос {i + 1}
                  </span>
                  <Tag tone={q.type === "open" ? "coral" : "green"}>
                    {questionTypeLabels[q.type]}
                  </Tag>
                </div>
                <div className="mb-3 font-display text-lg">{q.text}</div>

                {q.type === "single_choice" ? (
                  <ul className="flex flex-col gap-1.5">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi + 1 === q.correct;
                      return (
                        <li
                          key={oi}
                          className={
                            isCorrect
                              ? "rounded-sm bg-green-100 px-3 py-2 text-sm font-medium text-green-700"
                              : "px-3 py-2 text-sm text-ink-soft"
                          }
                        >
                          {optionLetter(oi)}. {opt}
                          {isCorrect && " ✓"}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  q.answer && (
                    <div className="rounded-sm bg-surface-muted px-3 py-2 text-sm">
                      <span className="text-ink-faint">Эталон: </span>
                      {q.answer}
                    </div>
                  )
                )}

                {q.explanation && (
                  <p className="mt-3 text-xs text-ink-soft">
                    Пояснение: {q.explanation}
                  </p>
                )}
              </Card>
            ))}
          </div>

          <form action={saveAction} className="mt-5 flex items-center gap-3">
            <input type="hidden" name="raw" value={preview.raw} />
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить в банк"}
            </Button>
            <Link
              href="/tutor/bank"
              className="text-[13px] font-medium text-ink-soft hover:underline"
            >
              Отмена
            </Link>
          </form>
        </>
      )}
    </div>
  );
}
