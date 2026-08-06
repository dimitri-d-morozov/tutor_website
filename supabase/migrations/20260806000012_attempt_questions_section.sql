-- Добавляем section_id в attempt_questions — нужен для группировки «Работы
-- над ошибками» по разделам, а не только по темам.
--
-- ВНИМАНИЕ: этот view — граница безопасности (см. 20260806000009). security_invoker
-- = false и WHERE-условие переносим без изменений, добавляем только колонку.
--
-- CREATE OR REPLACE VIEW позволяет только дописать новую колонку в конец
-- списка — если вставить её в середину, существующие колонки сдвигаются
-- и Postgres падает с "cannot change name of view column". Поэтому
-- section_id — последней.

create or replace view public.attempt_questions
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
  sa.reviewed_at,
  q.section_id
from student_test_attempts a
join test_template_questions ttq on ttq.test_template_id = a.test_template_id
join questions q                 on q.id = ttq.question_id
left join student_answers sa     on sa.attempt_id = a.id and sa.question_id = q.id
where a.student_id = auth.uid() or public.is_tutor();
