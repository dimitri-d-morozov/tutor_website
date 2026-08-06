"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/labels";
import { reviewAnswer } from "@/app/(tutor)/tutor/review/actions";

/**
 * Выставление балла за развёрнутый ответ.
 *
 * Балл выбирается кнопками 0…max, а не полем ввода: вариантов всегда мало
 * (обычно 0–2), и один клик быстрее, чем набор цифры. Комментарий необязателен —
 * ученик увидит его в работе над ошибками.
 */
export function ReviewForm({
  answerId,
  maxPoints,
}: {
  answerId: string;
  maxPoints: number;
}) {
  const [points, setPoints] = useState<number | null>(null);

  return (
    <form action={reviewAnswer} className="flex flex-col gap-3">
      <input type="hidden" name="answer_id" value={answerId} />
      <input type="hidden" name="points" value={points ?? ""} />

      <div>
        <span className="mb-1.5 block text-xs font-medium text-ink-soft">
          Балл — из {maxPoints}{" "}
          {plural(maxPoints, "возможного", "возможных", "возможных")}
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: maxPoints + 1 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPoints(n)}
              className={cn(
                "h-9 w-10 rounded-sm border text-sm font-medium transition-colors",
                points === n
                  ? "border-green-700 bg-green-700 text-white"
                  : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Field label="Комментарий ученику" hint="Необязательно">
        <Textarea
          name="comment"
          rows={2}
          placeholder="Что упущено, на что обратить внимание"
        />
      </Field>

      <div>
        <Button type="submit" disabled={points === null}>
          {points === null ? "Выберите балл" : "Проверено"}
        </Button>
      </div>
    </form>
  );
}
