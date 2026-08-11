-- Проверка подсчёта баллов для multiple_choice вопросов
-- Запустить после `supabase db reset`

-- Вопрос multiple_choice: правильные ответы ["a", "b", "c"]
select 'Вопрос multiple_choice:' as check_type, text from questions where id = 'd0000000-0000-0000-0000-000000000004';

-- ─── Проверка попыток Пети ───────────────────────────────────────────────────

-- Попытка 1: правильно выбраны все варианты ["a","b","c"] → должно быть 2 балла
select
  'Попытка 1 (все верно)' as scenario,
  given_answer,
  points as полученные_баллы,
  case when points = 2 then '✓ PASS' else '✗ FAIL' end as статус
from student_answers
where attempt_id = 'a2000000-0000-0000-0000-000000000001'
  and question_id = 'd0000000-0000-0000-0000-000000000004';

-- Попытка 2: одна ошибка ["a","b"] (пропущен "c") → должно быть 1 балл
select
  'Попытка 2 (одна ошибка)' as scenario,
  given_answer,
  points as полученные_баллы,
  case when points = 1 then '✓ PASS' else '✗ FAIL' end as статус
from student_answers
where attempt_id = 'a2000000-0000-0000-0000-000000000002'
  and question_id = 'd0000000-0000-0000-0000-000000000004';

-- Попытка 3: две ошибки ["a"] (пропущены "b" и "c") → должно быть 0 баллов
select
  'Попытка 3 (две ошибки)' as scenario,
  given_answer,
  points as полученные_баллы,
  case when points = 0 then '✓ PASS' else '✗ FAIL' end as статус
from student_answers
where attempt_id = 'a2000000-0000-0000-0000-000000000003'
  and question_id = 'd0000000-0000-0000-0000-000000000004';

-- ─── Сводная таблица ──────────────────────────────────────────────────────────
select
  'ИТОГО' as summary,
  count(*) as всего_проверок,
  sum(case when points = 2 then 1 else 0 end) as полные_баллы,
  sum(case when points = 1 then 1 else 0 end) as половина,
  sum(case when points = 0 then 1 else 0 end) as ноль
from student_answers
where question_id = 'd0000000-0000-0000-0000-000000000004';
