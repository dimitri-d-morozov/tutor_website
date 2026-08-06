-- GRANT-ы для Data API (PostgREST).
--
-- Зачем этот файл: в актуальных версиях Supabase таблицы, созданные в схеме `public`,
-- НЕ выдаются ролям Data API (`anon`, `authenticated`, `service_role`) автоматически —
-- см. `auto_expose_new_tables` в supabase/config.toml. Без явных GRANT-ов любой запрос
-- через supabase-js падает с «permission denied for table ...» (код 42501),
-- даже если RLS-политики разрешают доступ.
--
-- Разделение ответственности:
--   GRANT — грубый уровень: «роль вообще может обращаться к таблице».
--   RLS   — тонкий уровень: «какие именно строки видно и кто может писать»
--            (см. 20260730000002_rls.sql). RLS включён на всех таблицах ниже,
--            поэтому широкий GRANT для `authenticated` безопасен.
--
-- Роли `anon` не даём ничего: неавторизованному пользователю в приложении
-- доступен только сам вход (Auth API), данные — нет.
--
-- ВАЖНО: при добавлении новой таблицы в public нужно дописать её сюда
-- (или в новую миграцию), иначе она будет невидима для приложения.

grant select, insert, update, delete on
  profiles,
  student_profiles,
  topics,
  materials,
  lesson_templates,
  lesson_template_materials,
  questions,
  test_templates,
  test_template_questions,
  student_lessons,
  student_test_attempts,
  student_answers,
  payments
to authenticated;

-- View прогресса — только чтение (это вычисляемая проекция, писать в неё нельзя).
-- Создан с security_invoker = true, поэтому строки дополнительно фильтруются
-- RLS-политиками нижележащих таблиц от имени текущего пользователя.
grant select on student_topic_progress to authenticated;

-- Хелпер is_tutor() вызывается внутри RLS-политик, т.е. исполняется от имени
-- текущей роли — ей нужен EXECUTE.
grant execute on function public.is_tutor() to authenticated;
