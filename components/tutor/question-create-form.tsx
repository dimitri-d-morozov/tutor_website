"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  createQuestion,
  type QuestionFormState,
} from "@/app/(tutor)/tutor/bank/actions";

const initialState: QuestionFormState = { error: null };

/**
 * Создание вопроса прямо в карточке теста — чтобы добавить один вопрос
 * не приходилось перезаливать весь тест файлом.
 *
 * Тему, отдел и уровни вопрос унаследует от теста на сервере, поэтому здесь
 * их не спрашиваем: дублировать теги теста в каждом вопросе бессмысленно.
 *
 * ВАЖНО про закрытие модалки. Раньше кнопка отправки в onClick закрывала окно
 * и сбрасывала состояние — и сброс успевал поменять controlled-поля ДО того,
 * как форма собирала FormData. Тип вопроса возвращался в «с выбором», поля
 * вариантов появлялись пустыми, и сервер отвечал «нужно минимум два варианта»
 * даже для развёрнутого вопроса. Поэтому теперь окно закрывается только после
 * успеха действия (useActionState + useEffect), а ошибка показывается в форме.
 */
export function AddQuestionButton({ testId }: { testId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"single_choice" | "multiple_choice" | "open">("single_choice");
  // Минимум два варианта: вопрос с одним вариантом ответа бессмыслен.
  const [options, setOptions] = useState(["", ""]);
  // Для single_choice: индекс верного варианта
  // Для multiple_choice: массив индексов верных вариантов
  const [correct, setCorrect] = useState<number | number[]>(0);
  const [state, formAction, pending] = useActionState(
    createQuestion,
    initialState,
  );

  function reset() {
    setType("single_choice");
    setOptions(["", ""]);
    setCorrect(0);
  }

  // Вопрос создан — закрываем окно и очищаем поля под следующий вопрос.
  //
  // Правило react-hooks/set-state-in-effect запрещает setState в эффекте, потому
  // что обычно это признак состояния, которое надо было вычислить при рендере.
  // Здесь другой случай: мы реагируем на завершение серверного действия —
  // внешнее событие, из пропсов и состояния его не вывести. Закрывать окно
  // в onClick кнопки нельзя: сброс полей успевает сработать до сбора FormData
  // (именно так и появлялась ошибка «нужно минимум два варианта»).
  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      reset();
    }
  }, [state.ok]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Добавить вопрос</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Новый вопрос"
        className="w-[600px]"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="test_id" value={testId} />
          <input type="hidden" name="type" value={type} />

          <Field label="Тип вопроса">
            <Select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as "single_choice" | "multiple_choice" | "open";
                setType(newType);
                // Сброс верных ответов при смене типа
                setCorrect(newType === "multiple_choice" ? [] : 0);
              }}
            >
              <option value="single_choice">Один верный ответ</option>
              <option value="multiple_choice">Несколько верных ответов</option>
              <option value="open">Развёрнутый — проверяете вы</option>
            </Select>
          </Field>

          <Field label="Текст вопроса">
            <Textarea
              name="text"
              rows={3}
              required
              placeholder="Например: Опишите роль митохондрий в клетке."
            />
          </Field>

          {(type === "single_choice" || type === "multiple_choice") ? (
            <Field
              label="Варианты ответа"
              hint={type === "single_choice"
                ? "Отметьте кружком верный вариант"
                : "Отметьте галочками все верные варианты"}
            >
              {type === "single_choice" ? (
                <input type="hidden" name="correct_index" value={Number(correct)} />
              ) : (
                <input type="hidden" name="correct_indices" value={JSON.stringify(correct)} />
              )}
              <div className="flex flex-col gap-2">
                {options.map((value, i) => {
                  const isCorrect = type === "single_choice"
                    ? correct === i
                    : Array.isArray(correct) && correct.includes(i);

                  return (
                    <div key={i} className="flex items-center gap-2">
                      {type === "single_choice" ? (
                        <button
                          type="button"
                          onClick={() => setCorrect(i)}
                          title="Отметить как верный"
                          className={cn(
                            "h-5 w-5 flex-none rounded-full border-2",
                            isCorrect
                              ? "border-green-700 bg-green-700"
                              : "border-border hover:border-green-500",
                          )}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!Array.isArray(correct)) return;
                            setCorrect(
                              correct.includes(i)
                                ? correct.filter((idx) => idx !== i)
                                : [...correct, i].sort((a, b) => a - b)
                            );
                          }}
                          title="Отметить как верный"
                          className={cn(
                            "h-5 w-5 flex-none border-2",
                            isCorrect
                              ? "border-green-700 bg-green-700"
                              : "border-border hover:border-green-500",
                          )}
                        />
                      )}
                      <Input
                        name="option"
                        value={value}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((v, j) => (j === i ? e.target.value : v)),
                          )
                        }
                        placeholder={`Вариант ${i + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-coral"
                        disabled={options.length <= 2}
                        onClick={() => {
                          setOptions((prev) => prev.filter((_, j) => j !== i));
                          // Верный вариант мог сдвинуться или исчезнуть.
                          if (type === "single_choice") {
                            setCorrect((c) => {
                              const idx = c as number;
                              return idx > i ? idx - 1 : idx === i ? 0 : idx;
                            });
                          } else if (Array.isArray(correct)) {
                            setCorrect(
                              correct
                                .filter((idx) => idx !== i)
                                .map((idx) => idx > i ? idx - 1 : idx)
                            );
                          }
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="mt-1"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                + Ещё вариант
              </Button>
            </Field>
          ) : (
            <Field
              label="Эталонный ответ"
              hint="Виден только вам — при проверке"
            >
              <Textarea
                name="correct_answer"
                rows={2}
                placeholder="Что должно быть в полном ответе"
              />
            </Field>
          )}

          <Field
            label="Максимум баллов"
            hint={
              type === "open"
                ? "Сможете поставить частичный балл при проверке"
                : type === "multiple_choice"
                  ? "При одной ошибке — половина баллов, при двух и более — 0"
                  : "Начисляется целиком либо не начисляется"
            }
          >
            {/* key заставляет пересоздать поле при смене типа — иначе
                defaultValue остался бы от предыдущего выбора. */}
            <Input
              key={type}
              type="number"
              name="max_points"
              min={1}
              max={10}
              defaultValue={type === "open" || type === "multiple_choice" ? 2 : 1}
            />
          </Field>

          <Field label="Пояснение" hint="Ученик увидит в работе над ошибками">
            <Textarea name="explanation" rows={2} />
          </Field>

          {state.error && <p className="text-sm text-coral">{state.error}</p>}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Отмена
            </Button>
            {/* Никаких onClick: любое изменение состояния здесь успевает
                сбросить поля до того, как форма соберёт данные. */}
            <Button type="submit" disabled={pending}>
              {pending ? "Добавляем…" : "Добавить вопрос"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
