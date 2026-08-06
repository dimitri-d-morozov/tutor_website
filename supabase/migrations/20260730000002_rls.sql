-- RLS: ученик видит только свои данные; репетитор — всё.
-- Контент (темы/материалы/планы/вопросы/тесты) доступен на чтение всем
-- аутентифицированным, а на запись — только репетитору.

-- ─── Профили ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or public.is_tutor());

-- Роль/имя меняет только репетитор (студенту менять свою роль нельзя).
create policy profiles_write_tutor on profiles
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

-- ─── Доп. данные ученика ─────────────────────────────────────────────────────
alter table student_profiles enable row level security;

create policy sp_select on student_profiles
  for select to authenticated
  using (profile_id = auth.uid() or public.is_tutor());

create policy sp_write_tutor on student_profiles
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

-- ─── Контентные таблицы: чтение всем, запись — репетитору ─────────────────────
-- Хелпер-паттерн повторяется для каждой таблицы контента.
alter table topics                    enable row level security;
alter table materials                 enable row level security;
alter table lesson_templates          enable row level security;
alter table lesson_template_materials enable row level security;
alter table questions                 enable row level security;
alter table test_templates            enable row level security;
alter table test_template_questions   enable row level security;

create policy topics_select     on topics                    for select to authenticated using (true);
create policy topics_write      on topics                    for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy materials_select  on materials                 for select to authenticated using (true);
create policy materials_write   on materials                 for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy lt_select         on lesson_templates          for select to authenticated using (true);
create policy lt_write          on lesson_templates          for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy ltm_select        on lesson_template_materials for select to authenticated using (true);
create policy ltm_write         on lesson_template_materials for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy q_select          on questions                 for select to authenticated using (true);
create policy q_write           on questions                 for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tt_select         on test_templates            for select to authenticated using (true);
create policy tt_write          on test_templates            for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy ttq_select        on test_template_questions   for select to authenticated using (true);
create policy ttq_write         on test_template_questions   for all    to authenticated using (public.is_tutor()) with check (public.is_tutor());

-- ─── Экземпляры для ученика ───────────────────────────────────────────────────
alter table student_lessons       enable row level security;
alter table student_test_attempts enable row level security;
alter table student_answers        enable row level security;
alter table payments               enable row level security;

-- Занятия: ученик читает свои, назначает — только репетитор.
create policy sl_select on student_lessons
  for select to authenticated
  using (student_id = auth.uid() or public.is_tutor());
create policy sl_write_tutor on student_lessons
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());

-- Попытки тестов: ученик управляет своими, репетитор видит/правит все.
create policy sta_select on student_test_attempts
  for select to authenticated
  using (student_id = auth.uid() or public.is_tutor());
create policy sta_insert on student_test_attempts
  for insert to authenticated
  with check (student_id = auth.uid() or public.is_tutor());
create policy sta_update on student_test_attempts
  for update to authenticated
  using (student_id = auth.uid() or public.is_tutor())
  with check (student_id = auth.uid() or public.is_tutor());

-- Ответы: доступ по владельцу связанной попытки.
create policy sa_select on student_answers
  for select to authenticated
  using (exists (
    select 1 from student_test_attempts t
    where t.id = attempt_id and (t.student_id = auth.uid() or public.is_tutor())
  ));
create policy sa_insert on student_answers
  for insert to authenticated
  with check (exists (
    select 1 from student_test_attempts t
    where t.id = attempt_id and (t.student_id = auth.uid() or public.is_tutor())
  ));
create policy sa_update on student_answers
  for update to authenticated
  using (exists (
    select 1 from student_test_attempts t
    where t.id = attempt_id and (t.student_id = auth.uid() or public.is_tutor())
  ));

-- Платежи: ученик видит свои, изменяет — только репетитор.
create policy pay_select on payments
  for select to authenticated
  using (student_id = auth.uid() or public.is_tutor());
create policy pay_write_tutor on payments
  for all to authenticated
  using (public.is_tutor())
  with check (public.is_tutor());
