-- Поддержка вопросов с несколькими правильными ответами.

-- Добавляем новый тип вопроса
alter type question_type add value 'multiple_choice';

-- Для multiple_choice correct_answer будет массивом ID вариантов: ["a", "c"]
-- Схема уже поддерживает это (JSONB column), поэтому изменений в таблице не нужно.

comment on column questions.type is
  'single_choice: один правильный вариант (ID сохранится в correct_answer)
   multiple_choice: несколько правильных вариантов (массив ID: ["a", "c"])
   open: открытый вопрос (текст эталона в correct_answer)';

-- ─── Обновляем save_answer для поддержки multiple_choice ──────────────────────
-- Функция переопределяется целиком.
-- Логика подсчета баллов за multiple_choice:
--   0 ошибок (ни пропусков, ни лишних) → полный балл
--   1 ошибка (пропуск или лишний ответ) → половина баллов
--   2+ ошибки → 0 баллов

create or replace function public.save_answer(
  p_attempt  uuid,
  p_question uuid,
  p_answer   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_limit   int;
  v_type    question_type;
  v_max     int;
  v_correct jsonb;
  v_points  int;
  v_missing int;
  v_extra   int;
  v_errors  int;
  v_correct_arr text[];
  v_answer_arr text[];
  v_correct_count int;
  v_answer_count int;
  v_common_count int;
begin
  select a.*, t.time_limit_min
  into v_attempt
  from student_test_attempts a
  join test_templates t on t.id = a.test_template_id
  where a.id = p_attempt;

  if v_attempt is null then
    raise exception 'Попытка не найдена';
  end if;
  if v_attempt.student_id <> auth.uid() then
    raise exception 'Это попытка другого ученика';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'Тест уже сдан';
  end if;

  -- Без этой проверки таймер был бы украшением: достаточно открыть консоль.
  v_limit := v_attempt.time_limit_min;
  if v_limit is not null
     and now() > v_attempt.started_at + make_interval(mins => v_limit) then
    raise exception 'Время на тест истекло';
  end if;

  select type, max_points, correct_answer
  into v_type, v_max, v_correct
  from questions where id = p_question;

  if v_type is null then
    raise exception 'Вопрос не найден';
  end if;

  if v_type = 'single_choice' then
    v_points := case when p_answer = v_correct then v_max else 0 end;
  elsif v_type = 'multiple_choice' then
    -- Для multiple_choice: correct_answer и p_answer оба JSON массивы.
    -- 0 ошибок → полный балл
    -- 1 ошибка → половина баллов
    -- 2+ ошибки → 0 баллов

    -- Если p_answer не массив, трактуем как пустой массив
    if p_answer is null or jsonb_typeof(p_answer) != 'array' then
      p_answer := '[]'::jsonb;
    end if;

    -- Распакуем JSONB массивы в текстовые для надёжного сравнения
    v_correct_arr := array(select jsonb_array_elements_text(v_correct));
    v_answer_arr := array(select jsonb_array_elements_text(p_answer));

    v_correct_count := coalesce(array_length(v_correct_arr, 1), 0);
    v_answer_count := coalesce(array_length(v_answer_arr, 1), 0);

    -- Считаем сколько правильных ответов выбрано
    select count(*)::int into v_common_count
    from unnest(v_correct_arr) as elem
    where elem = any(v_answer_arr);
    v_common_count := coalesce(v_common_count, 0);

    -- Ошибки: не выбранные правильные + выбранные неправильные
    v_missing := v_correct_count - v_common_count;
    v_extra := v_answer_count - v_common_count;
    v_errors := v_missing + v_extra;

    if v_errors = 0 then
      v_points := v_max;
    elsif v_errors = 1 then
      v_points := greatest(1, v_max / 2);
    else
      v_points := 0;
    end if;
  else
    v_points := null;  -- развёрнутый проверяет репетитор
  end if;

  insert into student_answers (attempt_id, question_id, given_answer, points, is_correct)
  values (
    p_attempt, p_question, p_answer, v_points,
    case when v_points is null then null else v_points = v_max end
  )
  on conflict (attempt_id, question_id) do update
  set given_answer = excluded.given_answer,
      points       = excluded.points,
      is_correct   = excluded.is_correct;
end;
$$;

