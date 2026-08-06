-- Таймер перестаёт блокировать ответы.
--
-- Было: save_answer отказывал после истечения лимита. На практике это наказывает
-- ученика за то, что он думал дольше, и теряет уже набранный текст. Решение
-- заказчика: лимит остаётся ориентиром, превышение просто фиксируется — репетитор
-- увидит, что ученик не уложился, и сам решит, что с этим делать.
--
-- Отдельной колонки «не уложился» СОЗНАТЕЛЬНО нет: это вычисляется из
-- finished_at - started_at против time_limit_min (см. lib/tests/attempt.ts).
-- Хранимый флаг разошёлся бы с датами при любой их правке.
--
-- Что осталось: ответы нельзя править после сдачи и нельзя писать в чужую попытку.
-- Первое важно — иначе балл можно переписать задним числом уже после проверки.

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
  v_type    question_type;
  v_max     int;
  v_correct jsonb;
  v_points  int;
begin
  select a.* into v_attempt
  from student_test_attempts a
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

  select type, max_points, correct_answer
  into v_type, v_max, v_correct
  from questions where id = p_question;

  if v_type is null then
    raise exception 'Вопрос не найден';
  end if;

  if v_type = 'single_choice' then
    v_points := case when p_answer = v_correct then v_max else 0 end;
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
