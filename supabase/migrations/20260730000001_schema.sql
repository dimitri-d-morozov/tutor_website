-- Схема «БиоПодготовка» — базовая структура БД.
-- Принцип: контент (materials/lesson_templates/questions/test_templates) отделён
-- от экземпляров для ученика (student_lessons/student_test_attempts/...).

-- ─── Enum-типы ───────────────────────────────────────────────────────────────
create type user_role      as enum ('student', 'tutor');
create type exam_type       as enum ('ege', 'oge');
create type material_type   as enum ('presentation', 'textbook', 'video', 'homework', 'other');
create type lesson_status   as enum ('upcoming', 'completed');
create type question_type   as enum ('single_choice', 'open');
create type payment_status  as enum ('paid', 'pending', 'overdue');
create type attempt_status  as enum ('in_progress', 'completed', 'pending_review');

-- ─── Профили (1:1 к auth.users) ──────────────────────────────────────────────
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       user_role   not null default 'student',
  full_name  text        not null default '',
  created_at timestamptz not null default now()
);

-- Доп. данные ученика (видны репетитору): контакты, оплата, статус, заметка.
create table student_profiles (
  profile_id   uuid primary key references profiles (id) on delete cascade,
  exam_type    exam_type   not null default 'ege',
  grade        text,                       -- «11 класс»
  phone        text,
  messenger    text,
  parent_name  text,
  parent_phone text,
  tariff       text,                       -- «8 занятий / месяц»
  status       text        not null default 'active',   -- active | paused
  tutor_note   text,                       -- личная заметка репетитора
  created_at   timestamptz not null default now()
);

-- ─── Темы (кодификатор ФИПИ), поддерживают подтемы через parent_id ────────────
create table topics (
  id        uuid primary key default gen_random_uuid(),
  code      text,
  title     text      not null,
  exam_type exam_type not null default 'ege',
  parent_id uuid references topics (id) on delete cascade,
  position  int       not null default 0
);

-- ─── Контент (создаётся один раз) ────────────────────────────────────────────
create table materials (
  id           uuid primary key default gen_random_uuid(),
  title        text          not null,
  type         material_type not null default 'other',
  topic_id     uuid references topics (id) on delete set null,
  description  text,
  storage_path text,
  created_at   timestamptz   not null default now()
);

create table lesson_templates (
  id         uuid primary key default gen_random_uuid(),
  position   int         not null default 0,
  title      text        not null,
  tutor_note text,
  created_at timestamptz not null default now()
);

-- Многие-ко-многим: материалы ↔ планы уроков.
create table lesson_template_materials (
  lesson_template_id uuid not null references lesson_templates (id) on delete cascade,
  material_id        uuid not null references materials (id) on delete cascade,
  role_in_lesson     text,           -- Презентация | Учебник | Домашнее задание | Дополнительно
  position           int  not null default 0,
  primary key (lesson_template_id, material_id)
);

create table questions (
  id             uuid primary key default gen_random_uuid(),
  text           text          not null,
  topic_id       uuid references topics (id) on delete set null,
  type           question_type not null default 'single_choice',
  options        jsonb,          -- [{ "id": "a", "text": "..." }] для single_choice
  correct_answer jsonb,          -- id верного варианта или эталон для open
  explanation    text,
  created_at     timestamptz   not null default now()
);

create table test_templates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  topic_id       uuid references topics (id) on delete set null,
  time_limit_min int,
  created_at     timestamptz not null default now()
);

-- Многие-ко-многим: вопросы ↔ тесты.
create table test_template_questions (
  test_template_id uuid not null references test_templates (id) on delete cascade,
  question_id      uuid not null references questions (id) on delete cascade,
  position         int  not null default 0,
  primary key (test_template_id, question_id)
);

-- ─── Экземпляры для ученика ───────────────────────────────────────────────────
create table student_lessons (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references profiles (id) on delete cascade,
  lesson_template_id uuid references lesson_templates (id) on delete set null,
  scheduled_at       timestamptz,
  meeting_url        text,
  status             lesson_status not null default 'upcoming',
  created_at         timestamptz   not null default now()
);

create table student_test_attempts (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references profiles (id) on delete cascade,
  test_template_id uuid references test_templates (id) on delete set null,
  started_at       timestamptz    not null default now(),
  finished_at      timestamptz,
  status           attempt_status not null default 'in_progress',
  score            int,
  total            int
);

create table student_answers (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references student_test_attempts (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  given_answer jsonb,
  is_correct  boolean,
  created_at  timestamptz not null default now()
);

create table payments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  paid_on    date,
  amount     numeric(10, 2) not null,
  status     payment_status not null default 'pending',
  created_at timestamptz    not null default now()
);

-- ─── Прогресс ученика по темам — вычисляемый view, не таблица ─────────────────
create view student_topic_progress
with (security_invoker = true) as
select
  a.student_id,
  q.topic_id,
  count(*) filter (where sa.is_correct)                                  as correct,
  count(*)                                                               as total,
  round(100.0 * count(*) filter (where sa.is_correct) / nullif(count(*), 0)) as percent
from student_answers sa
join student_test_attempts a on a.id = sa.attempt_id
join questions q             on q.id = sa.question_id
group by a.student_id, q.topic_id;

-- ─── Вспомогательные функции ─────────────────────────────────────────────────
-- Текущий пользователь — репетитор?
create function public.is_tutor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'tutor'
  );
$$;

-- Автосоздание профиля при регистрации пользователя.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
