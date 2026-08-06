-- Тема становится единицей плана вместо занятия.
--
-- Было: шаблон курса — плоский список занятий (lesson_templates), один для всех
-- уровней подготовки. Материалы и ДЗ висели на занятии.
--
-- Проблема: один ученик проходит тему за один урок, другой — за три. С занятием
-- как единицей под каждый темп приходится плодить копии шаблонов. И программы
-- ОГЭ / ЕГЭ / олимпиады различаются составом и порядком тем, а шаблон один.
--
-- Стало: единица плана — ТЕМА. Материалы и ДЗ висят на теме (то, что не меняется),
-- а сколько занятий уходит на тему — свойство конкретного ученика: несколько
-- student_lessons могут ссылаться на одну тему. Программа (courses) — упорядоченный
-- список тем под уровень, с плановым числом занятий на каждую.
--
-- lesson_templates и её junction-таблицы удаляются: держать и занятие-шаблон,
-- и тему — значит держать две конкурирующие единицы плана.

-- ─── Темы: отдел, уровни, редактируемость ────────────────────────────────────
alter table topics
  add column section_id uuid references sections (id) on delete set null,
  add column levels     exam_type[] not null default '{}';

-- Тема из ОГЭ и та же тема из ЕГЭ — одна запись с двумя уровнями: материалы
-- копятся на одной теме и переиспользуются между программами, а глубину задаёт
-- то, какие материалы и тесты помечены каким уровнем.
update topics set levels = array[exam_type];

alter table topics drop column exam_type;

-- parent_id (подтемы) убираем: группировку теперь даёт sections, а две
-- конкурирующие иерархии только путают. Колонка нигде не использовалась.
alter table topics drop column parent_id;

-- ─── Содержимое темы (переезд с занятия на тему) ──────────────────────────────
-- Роли те же, что были у занятия: презентация и доп. материалы.
-- ДЗ — это тесты, поэтому отдельная таблица.
create table topic_materials (
  topic_id    uuid not null references topics (id)    on delete cascade,
  material_id uuid not null references materials (id) on delete cascade,
  role        lesson_material_role not null default 'extra',
  position    int  not null default 0,
  primary key (topic_id, material_id)
);

create table topic_tests (
  topic_id         uuid not null references topics (id)         on delete cascade,
  test_template_id uuid not null references test_templates (id) on delete cascade,
  position         int  not null default 0,
  primary key (topic_id, test_template_id)
);

-- ─── Программы подготовки ─────────────────────────────────────────────────────
-- Именованные, а не по одной на уровень: «ЕГЭ годовой» и «ЕГЭ интенсив с января»
-- отличаются составом и темпом, но оба про ЕГЭ.
create table courses (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null,
  level      exam_type   not null,
  created_at timestamptz not null default now()
);

create table course_topics (
  course_id uuid not null references courses (id) on delete cascade,
  topic_id  uuid not null references topics (id)  on delete cascade,
  position  int  not null default 0,
  -- Сколько занятий отводим теме по умолчанию. У конкретного ученика число может
  -- отличаться — это лишь заготовка для генерации плана.
  planned_lessons int not null default 1 check (planned_lessons between 1 and 20),
  primary key (course_id, topic_id)
);

-- На какой программе ученик.
alter table student_profiles
  add column course_id uuid references courses (id) on delete set null;

-- ─── Занятие ученика ссылается на тему ────────────────────────────────────────
alter table student_lessons
  add column topic_id uuid references topics (id) on delete set null,
  -- Необязательное переименование конкретного занятия («Разбор ошибок»);
  -- по умолчанию заголовок берётся из темы.
  add column title text;

-- «Занятие 2 из 3» СОЗНАТЕЛЬНО не храним: вычисляется при рендере группировкой
-- занятий ученика по теме. Счётчик в БД разошёлся бы с реальностью после первой
-- же правки плана (удалили занятие в середине — и все номера врут).

alter table student_lessons drop column lesson_template_id;

drop table lesson_template_tests;
drop table lesson_template_materials;
drop table lesson_templates;

drop function public.instantiate_plan_for_student(uuid);

-- ─── RPC: сгенерировать план ученика по программе ─────────────────────────────
-- Идемпотентна: для каждой темы программы досоздаёт занятия до planned_lessons,
-- уже существующие считает. Поэтому «Дополнить план по программе» после
-- пополнения программы добавит только новое и не тронет правки в плане ученика
-- и отметки «проведено».
--
-- Даты: первое новое занятие получает p_start, а если он null — следующий слот
-- после самого позднего занятия ученика. Дальше шаг p_interval_days.
create function public.generate_plan_for_student(
  p_student       uuid,
  p_course        uuid,
  p_start         timestamptz default null,
  p_interval_days int default 7
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_topic     record;
  v_lesson_id uuid;
  v_position  int;
  v_next      timestamptz;
  v_have      int;
  v_created   int := 0;
begin
  if not public.is_tutor() then
    raise exception 'Формировать план ученика может только репетитор';
  end if;

  if p_interval_days is null or p_interval_days < 1 then
    raise exception 'Периодичность должна быть не меньше одного дня';
  end if;

  -- Продолжаем нумерацию и расписание с того места, где ученик остановился.
  select coalesce(max(position), 0) into v_position
  from student_lessons where student_id = p_student;

  v_next := p_start;
  if v_next is null then
    select max(scheduled_at) + make_interval(days => p_interval_days)
    into v_next
    from student_lessons where student_id = p_student;
  end if;

  for v_topic in
    select ct.topic_id, ct.planned_lessons
    from course_topics ct
    where ct.course_id = p_course
    order by ct.position
  loop
    select count(*) into v_have
    from student_lessons
    where student_id = p_student and topic_id = v_topic.topic_id;

    while v_have < v_topic.planned_lessons loop
      v_position := v_position + 1;

      insert into student_lessons (student_id, topic_id, position, scheduled_at, status)
      values (p_student, v_topic.topic_id, v_position, v_next, 'upcoming')
      returning id into v_lesson_id;

      -- Материализуем содержимое темы. Когда тема идёт несколько занятий, копии
      -- одинаковые — дальше репетитор распределяет их между занятиями
      -- (презентацию на первое, ДЗ на последнее).
      insert into student_lesson_materials (student_lesson_id, material_id, role, position)
      select v_lesson_id, material_id, role, position
      from topic_materials where topic_id = v_topic.topic_id;

      insert into student_lesson_tests (student_lesson_id, test_template_id, position)
      select v_lesson_id, test_template_id, position
      from topic_tests where topic_id = v_topic.topic_id;

      if v_next is not null then
        v_next := v_next + make_interval(days => p_interval_days);
      end if;

      v_have    := v_have + 1;
      v_created := v_created + 1;
    end loop;
  end loop;

  return v_created;
end;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table topic_materials enable row level security;
alter table topic_tests     enable row level security;
alter table courses         enable row level security;
alter table course_topics   enable row level security;

-- Состав темы — служебная информация репетитора: ученик работает со своим
-- материализованным планом (student_lesson_*), где действует правило видимости.
-- Если открыть эти таблицы ученику, он узнает содержимое будущих занятий.
create policy topic_materials_tutor on topic_materials
  for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());

create policy topic_tests_tutor on topic_tests
  for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());

-- Программы читают все авторизованные: ученику показываем название его программы.
-- Состав программы (course_topics) — тоже лишь перечень тем, не контент.
create policy courses_select on courses
  for select to authenticated using (true);
create policy courses_write on courses
  for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());

create policy course_topics_select on course_topics
  for select to authenticated using (true);
create policy course_topics_write on course_topics
  for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());

-- ─── GRANT-ы для Data API ─────────────────────────────────────────────────────
-- Без них новая таблица невидима для приложения (см. 20260730000003_grants.sql).
grant select, insert, update, delete on
  topic_materials,
  topic_tests,
  courses,
  course_topics
to authenticated;

grant execute on function
  public.generate_plan_for_student(uuid, uuid, timestamptz, int)
to authenticated;
