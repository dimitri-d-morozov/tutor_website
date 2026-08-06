-- Прохождение тестов, баллы за развёрнутые ответы, проверка репетитором.
--
-- Два принципа, из которых следует вся эта миграция:
--
-- 1. correct_answer не должен покидать БД до сдачи. Значит: таблица questions
--    закрывается от учеников целиком, вопросы им отдаёт view без этой колонки,
--    а начисление баллов живёт в функциях, а не в приложении.
-- 2. Балл за развёрнутый ответ — число, а не «верно/неверно»: во второй части ЕГЭ
--    по биологии задания стоят 2–3 балла, и частично верный ответ должен давать
--    частичный балл.

-- ─── Баллы ────────────────────────────────────────────────────────────────────
alter table questions
  add column max_points int not null default 1
    check (max_points between 1 and 10);

comment on column questions.max_points is
  'Максимум баллов за вопрос. У вопросов с выбором обычно 1, у развёрнутых 2–3.';

alter table student_answers
  add column points        int,
  add column tutor_comment text,
  add column reviewed_at   timestamptz;

comment on column student_answers.points is
  'Начислено баллов. Вопрос с выбором проверяется автоматически при сохранении, '
  'развёрнутый остаётся NULL до проверки репетитором.';

comment on column student_answers.is_correct is
  'Полный балл (points = max_points). По этому полю строится работа над ошибками.';

-- Один ответ на вопрос в рамках попытки — нужно для on conflict в save_answer.
alter table student_answers
  add constraint student_answers_attempt_question_key unique (attempt_id, question_id);

-- ─── Прогресс считаем в баллах ────────────────────────────────────────────────
-- Было: доля верных ответов по счёту. Ответ на 1 из 2 баллов давал бы 0%,
-- что для второй части ЕГЭ неверно. Колонки переименованы намеренно: старые
-- correct/total теперь означали бы не то, что написано.
drop view student_topic_progress;

-- security_invoker = false — по той же причине, что и у attempt_questions ниже:
-- view соединяется с questions, а её мы закрываем от учеников. С invoker-
-- семантикой ученик не видел бы собственного прогресса вообще. Границей доступа
-- служит WHERE: свой прогресс либо всё для репетитора.
create view student_topic_progress
with (security_invoker = false) as
select
  a.student_id,
  q.topic_id,
  sum(coalesce(sa.points, 0))                                  as earned_points,
  sum(q.max_points)                                            as max_points,
  round(100.0 * sum(coalesce(sa.points, 0)) / nullif(sum(q.max_points), 0)) as percent
from student_answers sa
join student_test_attempts a on a.id = sa.attempt_id
join questions q             on q.id = sa.question_id
where a.student_id = auth.uid() or public.is_tutor()
group by a.student_id, q.topic_id;

grant select on student_topic_progress to authenticated;

-- ─── Закрываем верные ответы от учеников ──────────────────────────────────────
-- Колоночные GRANT-ы тут не работают: репетитор и ученик — одна роль
-- `authenticated`, привилегии их не различают. Поэтому таблицу закрываем целиком.
drop policy q_select   on questions;
drop policy ttq_select on test_template_questions;

create policy q_select_tutor on questions
  for select to authenticated
  using (public.is_tutor());

-- Состав теста (какие вопросы и в каком порядке) ученику показать можно: строки
-- содержат только идентификаторы, а сами вопросы закрыты политикой выше. Это
-- нужно, чтобы в списке тестов честно писать «10 вопросов».
-- Критерий доступа повторяет tt_select: RLS таблицы test_templates внутри чужой
-- политики не применяется, поэтому условие приходится продублировать.
create policy ttq_select on test_template_questions
  for select to authenticated
  using (
    public.is_tutor()
    or exists (
      select 1
      from test_templates t
      join student_lessons sl on sl.topic_id = t.topic_id
      where t.id = test_template_questions.test_template_id
        and sl.student_id = auth.uid()
        and sl.status = 'completed'
    )
  );

-- Вопросы попытки — без correct_answer.
--
-- ВНИМАНИЕ: security_invoker = false здесь ОБЯЗАТЕЛЬНО и намеренно. View должен
-- обойти RLS на questions (иначе ученик не получит ничего), поэтому границей
-- доступа служит собственное условие WHERE ниже — auth.uid() против владельца
-- попытки. Это единственное место в проекте с такой семантикой: любая правка
-- этого view — правка границы безопасности.
create view attempt_questions
with (security_invoker = false) as
select
  a.id            as attempt_id,
  a.student_id,
  ttq.position,
  q.id            as question_id,
  q.text,
  q.type,
  q.options,
  q.explanation,
  q.max_points,
  q.topic_id,
  sa.id           as answer_id,
  sa.given_answer,
  sa.points,
  sa.is_correct,
  sa.tutor_comment,
  sa.reviewed_at
from student_test_attempts a
join test_template_questions ttq on ttq.test_template_id = a.test_template_id
join questions q                 on q.id = ttq.question_id
left join student_answers sa     on sa.attempt_id = a.id and sa.question_id = q.id
where a.student_id = auth.uid() or public.is_tutor();

grant select on attempt_questions to authenticated;

-- ─── Доступ к тестам: только по пройденным темам ──────────────────────────────
-- Иначе сокрытие ДЗ будущего занятия обходится через «Тесты по темам»: тот же
-- тест открывается напрямую.
drop policy tt_select on test_templates;

create policy tt_select on test_templates
  for select to authenticated
  using (
    public.is_tutor()
    or exists (
      select 1 from student_lessons sl
      where sl.student_id = auth.uid()
        and sl.status = 'completed'
        and sl.topic_id = test_templates.topic_id
    )
  );

-- ─── RPC прохождения ──────────────────────────────────────────────────────────
-- Все три функции ниже — SECURITY DEFINER, и это следствие закрытия questions:
-- ученику нужно сохранить ответ и получить балл, но читать correct_answer и
-- max_points ему нельзя. Функция читает их от имени владельца, поэтому вся
-- авторизация в ней ЯВНАЯ — сверка auth.uid() с владельцем попытки в каждой.
-- Добавляя сюда что-то, проверяйте права руками: RLS больше не подстрахует.

-- Начать попытку. Незавершённую попытку того же теста возвращаем как есть:
-- иначе каждый вход плодил бы брошенные попытки и «лучший результат» терял смысл.
create function public.start_attempt(
  p_test          uuid,
  p_student_lesson uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_topic   uuid;
  v_attempt uuid;
begin
  if v_student is null then
    raise exception 'Не авторизован';
  end if;

  select topic_id into v_topic from test_templates where id = p_test;
  if v_topic is null then
    raise exception 'Тест не найден или у него не указана тема';
  end if;

  -- Тот же критерий, что и в политике tt_select: тест доступен, если тема
  -- пройдена. Проверяем и здесь — RPC не должна полагаться на то, что клиент
  -- предварительно прочитал список доступных тестов.
  if not public.is_tutor() and not exists (
    select 1 from student_lessons sl
    where sl.student_id = v_student
      and sl.status = 'completed'
      and sl.topic_id = v_topic
  ) then
    raise exception 'Тест станет доступен после занятия по этой теме';
  end if;

  select id into v_attempt
  from student_test_attempts
  where student_id = v_student
    and test_template_id = p_test
    and status = 'in_progress'
  order by started_at desc
  limit 1;

  if v_attempt is not null then
    return v_attempt;
  end if;

  insert into student_test_attempts (student_id, test_template_id, student_lesson_id)
  values (v_student, p_test, p_student_lesson)
  returning id into v_attempt;

  return v_attempt;
end;
$$;

-- ─── RPC: сохранить ответ ─────────────────────────────────────────────────────
-- Вопрос с выбором проверяется здесь же — сравнение с correct_answer не покидает
-- базу. Развёрнутый сохраняется с points = NULL и ждёт репетитора.
create function public.save_answer(
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

-- ─── RPC: сдать тест ──────────────────────────────────────────────────────────
create function public.finish_attempt(p_attempt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_status  attempt_status;
  v_pending int;
begin
  select student_id, status into v_student, v_status
  from student_test_attempts where id = p_attempt;

  if v_student is null then
    raise exception 'Попытка не найдена';
  end if;
  if v_student <> auth.uid() and not public.is_tutor() then
    raise exception 'Это попытка другого ученика';
  end if;
  if v_status <> 'in_progress' then
    return;  -- повторная сдача (например, автосдача по таймеру) — не ошибка
  end if;

  -- Считаем только РАЗВЁРНУТЫЕ ОТВЕТЫ, КОТОРЫЕ УЧЕНИК ДАЛ (answer_id not null).
  -- Если открытый вопрос просто пропущен, проверять нечего — иначе попытка
  -- навсегда осталась бы в pending_review, а репетитор не смог бы её закрыть.
  -- Пропущенный вопрос при этом идёт в знаменатель (total) с нулём баллов.
  select count(*) into v_pending
  from attempt_questions
  where attempt_id = p_attempt
    and type = 'open'
    and answer_id is not null
    and points is null;

  update student_test_attempts a
  set finished_at = now(),
      -- Каст обязателен: CASE отдаёт text, а колонка типа attempt_status.
      status      = (case when v_pending > 0 then 'pending_review' else 'completed' end)::attempt_status,
      score       = coalesce((
        select sum(coalesce(sa.points, 0))
        from student_answers sa where sa.attempt_id = a.id
      ), 0),
      total       = coalesce((
        select sum(q.max_points)
        from test_template_questions ttq
        join questions q on q.id = ttq.question_id
        where ttq.test_template_id = a.test_template_id
      ), 0)
  where a.id = p_attempt;
end;
$$;

-- ─── RPC: проверить развёрнутый ответ ─────────────────────────────────────────
create function public.review_answer(
  p_answer  uuid,
  p_points  int,
  p_comment text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_attempt uuid;
  v_max     int;
  v_pending int;
begin
  if not public.is_tutor() then
    raise exception 'Проверять ответы может только репетитор';
  end if;

  select sa.attempt_id, q.max_points
  into v_attempt, v_max
  from student_answers sa
  join questions q on q.id = sa.question_id
  where sa.id = p_answer;

  if v_attempt is null then
    raise exception 'Ответ не найден';
  end if;
  if p_points is null or p_points < 0 or p_points > v_max then
    raise exception 'Балл должен быть от 0 до %', v_max;
  end if;

  update student_answers
  set points        = p_points,
      is_correct    = (p_points = v_max),
      tutor_comment = p_comment,
      reviewed_at   = now()
  where id = p_answer;

  select count(*) into v_pending
  from student_answers sa
  join questions q on q.id = sa.question_id
  where sa.attempt_id = v_attempt and q.type = 'open' and sa.points is null;

  -- Всё проверено — пересчитываем балл и закрываем попытку.
  if v_pending = 0 then
    update student_test_attempts a
    set status = 'completed',
        score  = coalesce((
          select sum(coalesce(sa.points, 0))
          from student_answers sa where sa.attempt_id = a.id
        ), 0)
    where a.id = v_attempt;
  end if;
end;
$$;

-- ─── Импорт теста: подхватываем max_points ────────────────────────────────────
-- Функция создана в 20260806000005, когда колонки max_points ещё не было.
-- Применённую миграцию править нельзя, поэтому переопределяем здесь целиком.
create or replace function public.import_test(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_test_id     uuid;
  v_section_id  uuid   := nullif(payload ->> 'section_id', '')::uuid;
  v_topic_id    uuid   := nullif(payload ->> 'topic_id', '')::uuid;
  v_levels      exam_type[];
  v_question    jsonb;
  v_question_id uuid;
  v_position    int    := 0;
begin
  if not public.is_tutor() then
    raise exception 'Импортировать тесты может только репетитор';
  end if;

  select coalesce(array_agg(value::exam_type), '{}'::exam_type[])
  into v_levels
  from jsonb_array_elements_text(coalesce(payload -> 'levels', '[]'::jsonb));

  insert into test_templates (title, section_id, topic_id, levels, time_limit_min)
  values (
    payload ->> 'title',
    v_section_id,
    v_topic_id,
    v_levels,
    nullif(payload ->> 'time_limit_min', '')::int
  )
  returning id into v_test_id;

  for v_question in
    select value from jsonb_array_elements(payload -> 'questions')
  loop
    v_position := v_position + 1;

    insert into questions (
      text, section_id, topic_id, levels, type,
      options, correct_answer, explanation, max_points
    )
    values (
      v_question ->> 'text',
      v_section_id,
      v_topic_id,
      v_levels,
      (v_question ->> 'type')::question_type,
      nullif(v_question -> 'options', 'null'::jsonb),
      nullif(v_question -> 'correct_answer', 'null'::jsonb),
      v_question ->> 'explanation',
      coalesce((v_question ->> 'max_points')::int, 1)
    )
    returning id into v_question_id;

    insert into test_template_questions (test_template_id, question_id, position)
    values (v_test_id, v_question_id, v_position);
  end loop;

  return v_test_id;
end;
$$;

-- ─── Права ────────────────────────────────────────────────────────────────────
grant execute on function public.start_attempt(uuid, uuid)          to authenticated;
grant execute on function public.save_answer(uuid, uuid, jsonb)     to authenticated;
grant execute on function public.finish_attempt(uuid)               to authenticated;
grant execute on function public.review_answer(uuid, int, text)     to authenticated;
