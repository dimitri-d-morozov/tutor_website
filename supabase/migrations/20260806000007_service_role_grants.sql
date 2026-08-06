-- GRANT-ы для service_role.
--
-- Зачем: в 20260730000003_grants.sql и 20260806000005_tutor_cabinet.sql права
-- выданы только роли `authenticated`. В результате service-role клиент
-- (lib/supabase/admin.ts) не мог читать и писать таблицы — запросы возвращали
-- «permission denied», что легко принять за пустой результат.
--
-- Приложению это пока не мешало: admin-клиент используется только для Admin API
-- (создание учеников) и Storage. Но в Supabase принято, что service_role имеет
-- полный доступ к таблицам, и отсутствие грантов — ловушка на будущее.
--
-- Безопасность: ключ service_role живёт только на сервере (переменная без
-- префикса NEXT_PUBLIC_) и в браузер не попадает. Эта роль и так обходит RLS,
-- поэтому GRANT-ы не расширяют её возможности — они лишь убирают неожиданный
-- отказ на уровне прав таблиц.

grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Таблицы, которые появятся позже, тоже должны быть доступны service_role,
-- иначе та же ловушка вернётся при следующей миграции.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
