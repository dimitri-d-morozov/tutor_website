-- Уровень подготовки и отделы биологии — две новые оси тегирования контента.
--
-- Почему отдельная миграция, а не вместе с остальным: Postgres запрещает
-- ИСПОЛЬЗОВАТЬ новое значение enum в той же транзакции, где оно добавлено
-- (alter type ... add value). Миграции Supabase выполняются в транзакции,
-- поэтому 'olympiad' добавляем здесь, а пользуемся им уже в следующем файле
-- и в seed.sql.

-- ─── Уровень: ОГЭ / ЕГЭ / Олимпиада ──────────────────────────────────────────
-- Переиспользуем существующий enum exam_type вместо нового типа: значения те же
-- самые, просто в интерфейсе контента подпись — «Уровень», а у ученика — «Экзамен».
alter type exam_type add value 'olympiad';

-- ─── Отдел биологии ──────────────────────────────────────────────────────────
-- Таблица, а не enum: репетитор правит список из интерфейса, без миграций.
create table sections (
  id       uuid primary key default gen_random_uuid(),
  title    text not null unique,
  position int  not null default 0
);

insert into sections (title, position) values
  ('Общая биология',    1),
  ('Цитология',         2),
  ('Ботаника',          3),
  ('Зоология',          4),
  ('Анатомия человека', 5),
  ('Генетика',          6),
  ('Эволюция',          7),
  ('Экология',          8);

alter table sections enable row level security;

create policy sections_select on sections
  for select to authenticated
  using (true);

create policy sections_write on sections
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

grant select, insert, update, delete on sections to authenticated;
