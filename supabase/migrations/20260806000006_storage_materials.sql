-- Приватный бакет для файлов материалов.
--
-- Политик на storage.objects здесь СОЗНАТЕЛЬНО нет — доступ остаётся закрытым для
-- всех ролей Data API. Загрузка файлов и выдача ссылок на скачивание идут через
-- service-role клиент в Server Actions, после явной проверки роли (lib/auth.ts).
--
-- Почему не «grant select on storage.objects to authenticated для этого бакета»:
-- такая политика разрешила бы ученику скачать файл будущего занятия, если он
-- узнает путь. Путь строится из uuid и угадать его трудно, но «трудно угадать» —
-- это не контроль доступа. Ссылку выдаёт сервер и только на разрешённый материал.

insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)  -- 50 MiB, как в config.toml
on conflict (id) do nothing;
