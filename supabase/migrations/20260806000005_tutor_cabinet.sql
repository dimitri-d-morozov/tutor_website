-- Кабинет репетитора: тегирование контента, состав занятия, индивидуальный план ученика.
--
-- Главная идея плана ученика: он МАТЕРИАЛИЗУЕТСЯ — при создании ученика шаблон курса
-- копируется ему целиком (student_lessons + student_lesson_materials + student_lesson_tests).
-- Дальше репетитор правит план конкретного ученика, не задевая шаблон и других учеников.
-- Альтернатива («шаблон + список добавлений + список исключений») дала бы сложную логику
-- склейки на каждом чтении — здесь она не нужна: учеников десятки, а не тысячи.

-- ─── Роль материала внутри занятия ───────────────────────────────────────────
-- Только две роли: презентация и доп. материалы для самостоятельного изучения.
-- Домашнее задание — это НЕ материал, а тест (см. lesson_template_tests ниже).
create type lesson_material_role as enum ('presentation', 'extra');

-- ─── Теги контента: отдел + уровень ──────────────────────────────────────────
-- levels — массив, а не одно значение: одна и та же презентация про строение клетки
-- обычно годится и для ОГЭ, и для ЕГЭ, дублировать её ради тега не нужно.
alter table materials
  add column section_id uuid references sections (id) on delete set null,
  add column levels     exam_type[] not null default '{}';

alter table test_templates
  add column section_id uuid references sections (id) on delete set null,
  add column levels     exam_type[] not null default '{}';

alter table questions
  add column section_id uuid references sections (id) on delete set null,
  add column levels     exam_type[] not null default '{}';

-- ─── Источник материала: файл в Storage ИЛИ внешняя ссылка ────────────────────
alter table materials
  add column external_url text,
  add column file_name    text,
  add column file_size    bigint;

-- Ровно один источник: иначе появляются материалы «ни туда ни сюда», которые
-- нечем открыть, и их приходится отлавливать проверками в каждом месте кода.
alter table materials
  add constraint materials_source_check check (
    (storage_path is not null and external_url is null)
    or (storage_path is null and external_url is not null)
  );

-- ─── Занятие в шаблоне курса ─────────────────────────────────────────────────
alter table lesson_templates
  add column topic_id uuid references topics (id) on delete set null;

-- role_in_lesson был свободным текстом («Презентация», «Учебник», …) — переводим
-- на enum, чтобы интерфейс мог раскладывать материалы по секциям занятия.
alter table lesson_template_materials
  add column role lesson_material_role not null default 'extra';

update lesson_template_materials
set role = 'presentation'
where role_in_lesson = 'Презентация';

alter table lesson_template_materials
  drop column role_in_lesson;

-- Домашнее задание шаблона: пока только тесты. Открытые вопросы добавим позже —
-- для этого достаточно будет второй junction-таблицы, схему ломать не придётся.
create table lesson_template_tests (
  lesson_template_id uuid not null references lesson_templates (id) on delete cascade,
  test_template_id   uuid not null references test_templates (id)   on delete cascade,
  position           int  not null default 0,
  primary key (lesson_template_id, test_template_id)
);

-- ─── Индивидуальный план ученика ─────────────────────────────────────────────
alter table student_lessons
  add column position   int not null default 0,
  add column tutor_note text;

comment on column student_lessons.scheduled_at is
  'Дата занятия: план — когда назначено, проведённое — когда фактически прошло.';

create table student_lesson_materials (
  student_lesson_id uuid not null references student_lessons (id) on delete cascade,
  material_id       uuid not null references materials (id)       on delete cascade,
  role              lesson_material_role not null default 'extra',
  position          int  not null default 0,
  primary key (student_lesson_id, material_id)
);

create table student_lesson_tests (
  student_lesson_id uuid not null references student_lessons (id) on delete cascade,
  test_template_id  uuid not null references test_templates (id)  on delete cascade,
  position          int  not null default 0,
  primary key (student_lesson_id, test_template_id)
);

-- Попытка теста может быть выполнением ДЗ конкретного занятия, а может быть
-- свободной практикой — отсюда nullable.
alter table student_test_attempts
  add column student_lesson_id uuid references student_lessons (id) on delete set null;

-- ─── RPC: собрать план ученика из шаблона ────────────────────────────────────
-- security invoker — RLS и проверка роли продолжают действовать от имени вызывающего.
-- Идемпотентна: занятия, уже созданные для этого ученика, пропускает. Возвращает
-- число добавленных занятий.
create function public.instantiate_plan_for_student(p_student uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template  record;
  v_lesson_id uuid;
  v_created   int := 0;
begin
  if not public.is_tutor() then
    raise exception 'Формировать план ученика может только репетитор';
  end if;

  for v_template in
    select id, position from lesson_templates order by position, created_at
  loop
    -- Уже есть у ученика — не дублируем (функцию можно вызывать повторно).
    if exists (
      select 1 from student_lessons
      where student_id = p_student and lesson_template_id = v_template.id
    ) then
      continue;
    end if;

    insert into student_lessons (student_id, lesson_template_id, position, status)
    values (p_student, v_template.id, v_template.position, 'upcoming')
    returning id into v_lesson_id;

    insert into student_lesson_materials (student_lesson_id, material_id, role, position)
    select v_lesson_id, material_id, role, position
    from lesson_template_materials
    where lesson_template_id = v_template.id;

    insert into student_lesson_tests (student_lesson_id, test_template_id, position)
    select v_lesson_id, test_template_id, position
    from lesson_template_tests
    where lesson_template_id = v_template.id;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

-- ─── RPC: импорт теста одной транзакцией ─────────────────────────────────────
-- Нужна именно для атомарности: «либо весь тест с вопросами, либо ничего».
-- Валидация и разбор файла остаются в TypeScript (zod) — сюда приходит уже
-- проверенный payload с готовыми uuid-ами темы и отдела.
create function public.import_test(payload jsonb)
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

    -- Вопросы наследуют отдел/тему/уровень теста: так банк вопросов
    -- фильтруется теми же тегами без ручной разметки каждого вопроса.
    insert into questions (
      text, section_id, topic_id, levels, type, options, correct_answer, explanation
    )
    values (
      v_question ->> 'text',
      v_section_id,
      v_topic_id,
      v_levels,
      (v_question ->> 'type')::question_type,
      nullif(v_question -> 'options', 'null'::jsonb),
      nullif(v_question -> 'correct_answer', 'null'::jsonb),
      v_question ->> 'explanation'
    )
    returning id into v_question_id;
    -- max_points выставляет отдельный оператор в 20260806000009: на момент этой
    -- миграции колонки ещё нет, а переписывать применённую миграцию нельзя.

    insert into test_template_questions (test_template_id, question_id, position)
    values (v_test_id, v_question_id, v_position);
  end loop;

  return v_test_id;
end;
$$;

-- ─── RLS для новых таблиц ────────────────────────────────────────────────────
alter table lesson_template_tests    enable row level security;
alter table student_lesson_materials enable row level security;
alter table student_lesson_tests     enable row level security;

-- Состав шаблона — служебная информация репетитора. Ученик работает со своим
-- материализованным планом (student_lesson_*), в шаблон ему смотреть незачем.
create policy ltt_all_tutor on lesson_template_tests
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

drop policy ltm_select on lesson_template_materials;
drop policy ltm_write  on lesson_template_materials;

create policy ltm_all_tutor on lesson_template_materials
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

-- ГЛАВНОЕ ПРАВИЛО ВИДИМОСТИ: содержимое занятия ученик видит только после того,
-- как занятие проведено. Репетитор видит всё и всегда.
create policy slm_select on student_lesson_materials
  for select to authenticated
  using (exists (
    select 1 from student_lessons sl
    where sl.id = student_lesson_id
      and (public.is_tutor()
           or (sl.student_id = auth.uid() and sl.status = 'completed'))
  ));

create policy slm_write_tutor on student_lesson_materials
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

create policy slt_select on student_lesson_tests
  for select to authenticated
  using (exists (
    select 1 from student_lessons sl
    where sl.id = student_lesson_id
      and (public.is_tutor()
           or (sl.student_id = auth.uid() and sl.status = 'completed'))
  ));

create policy slt_write_tutor on student_lesson_tests
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

-- ─── Ужесточение доступа к материалам ────────────────────────────────────────
-- Было `using (true)` — любой авторизованный читал всю библиотеку. Пока материал
-- был файлом, это ещё терпело: сама строка ничего не выдавала, файл лежал за
-- service-role. Но теперь материалом может быть ВНЕШНЯЯ ССЫЛКА, а она хранится
-- прямо в строке — то есть ученик обычным запросом к REST получил бы ссылку на
-- видео будущего занятия. Заодно перестают утекать названия и описания.
drop policy materials_select on materials;

create policy materials_select on materials
  for select to authenticated
  using (
    public.is_tutor()
    or exists (
      select 1
      from student_lesson_materials slm
      join student_lessons sl on sl.id = slm.student_lesson_id
      where slm.material_id = materials.id
        and sl.student_id = auth.uid()
        and sl.status = 'completed'
    )
  );

-- test_templates намеренно оставляем читаемыми всем авторизованным: страница
-- «Тесты по темам» — это свободная практика по любой теме, спойлером она не
-- является. Скрыт именно факт, что тест задан как ДЗ (политика slt_select выше).

-- ─── GRANT-ы для Data API ────────────────────────────────────────────────────
-- Без них новая таблица невидима для приложения (см. 20260730000003_grants.sql).
grant select, insert, update, delete on
  lesson_template_tests,
  student_lesson_materials,
  student_lesson_tests
to authenticated;

grant execute on function public.instantiate_plan_for_student(uuid) to authenticated;
grant execute on function public.import_test(jsonb)                 to authenticated;
