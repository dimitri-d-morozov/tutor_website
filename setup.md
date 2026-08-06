Часть 1. Развернуть локально на новом компьютере
1.1. Что установить
Программа	Версия	Зачем
Git	любая свежая	забрать код
Node.js	24 LTS (у тебя сейчас 26.5 — тоже ок; минимум для Next 16 — 20.9)	сборка и запуск Next.js
Docker Desktop	свежий	Supabase CLI поднимает Postgres/Auth/Storage в контейнерах
Supabase CLI	2.110+ (у тебя 2.110.0)	supabase start, миграции, генерация типов
VS Code	свежий	редактор
macOS

# Homebrew, если его нет
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git node@24 supabase/tap/supabase
brew install --cask docker visual-studio-code
Запусти Docker Desktop из Applications один раз и дождись «Docker is running» — CLI без него не стартует.

Windows
WSL2 (обязательно, Docker Desktop без него не работает): в PowerShell от админа wsl --install, перезагрузка.
Docker Desktop for Windows — при установке оставить «Use WSL 2 based engine».
Node.js 24 LTS — установщик с nodejs.org (или winget install OpenJS.NodeJS.LTS).
Git — winget install Git.Git.
Supabase CLI — winget install Supabase.CLI (либо scoop install supabase).
VS Code — winget install Microsoft.VisualStudioCode.
Важно для Windows: держи репозиторий внутри WSL (\\wsl$\Ubuntu\home\<user>\...) и открывай его через VS Code «WSL: Reopen in WSL». На NTFS-путях Next.js и Docker-волюмы работают заметно медленнее.

Расширения VS Code (минимум)
ESLint, Prettier, Tailwind CSS IntelliSense, а на Windows — WSL.

1.2. Развернуть проект

git clone https://github.com/dimitri-d-morozov/tutor_website.git
cd tutor_website
npm ci                       # именно ci, не install — ставит версии из package-lock.json
supabase start               # первый раз ~5-10 мин: тянет образы Postgres/GoTrue/Storage
supabase start в конце напечатает креды. Возьми оттуда API URL, anon key, service_role key (повторно — supabase status) и создай .env.local в корне:


NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key из supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key из supabase status>
Дальше применить схему и данные, и запустить:


supabase db reset            # прогоняет все 12 миграций + seed.sql
npm run dev                  # http://localhost:3000
Вход: tutor@bio.local / password123 (репетитор), anya@bio.local, petya@bio.local (ученики).

Полезное:

Supabase Studio — http://127.0.0.1:54323, письма (Inbucket) — http://127.0.0.1:54324.
После любой правки схемы: supabase gen types typescript --local > types/database.types.ts.
1.3. Грабли при переносе
Docker не запущен → supabase start падает с ошибкой подключения к демону. Запусти Docker Desktop.
Забыл .env.local → страницы падают на NEXT_PUBLIC_SUPABASE_URL = undefined, а создание ученика — на явной ошибке из admin.ts:20.
Заняты порты 54321–54324 или 6432 (в config.toml БД на 6432, не 5432) → останови старый стек: supabase stop --project-id <другой> или поправь порты в config.toml.
npm install вместо npm ci может подтянуть более новые минорные версии — на Next 16 / React 19 это иногда ломает сборку. Используй npm ci.
Node 18 или ниже → Next 16 не собирается вообще.
Часть 2. Деплой на виртуальную машину в облаке
2.1. Какую схему выбрать
CLAUDE.md предполагает «App Platform для Next.js + отдельный VPS под Supabase». Для одного репетитора и десятков учеников я бы сделал всё на одном VPS: дешевле, одна точка обслуживания, нет сетевой задержки между Next.js и БД, и файлы материалов не ходят через интернет. 152-ФЗ выполняется одинаково в обоих вариантах — ключевое, что дата-центр в РФ.

Итоговая архитектура на одном VPS:


Интернет → nginx (443, TLS от Let's Encrypt)
             ├── bio.example.ru      → Next.js (systemd, :3000)
             └── api.bio.example.ru  → Kong Supabase (docker, :8000)
                                        └── postgres / gotrue / storage / studio (только localhost)
Параметры VM: Ubuntu 24.04 LTS, 4 vCPU / 8 ГБ RAM / 80 ГБ NVMe, регион — Россия (Москва/СПб). Меньше 8 ГБ не советую: стек Supabase — это ~10 контейнеров, и сборка Next.js сама съедает ~2 ГБ.

Домен: нужны две A-записи на IP машины — bio.example.ru и api.bio.example.ru.

2.2. Базовая настройка сервера

ssh root@<IP>

# пользователь вместо root
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

apt update && apt upgrade -y
apt install -y ufw fail2ban git curl nginx

# swap — страховка на время сборки Next.js
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
systemctl enable --now fail2ban
Отключи вход по паролю: в /etc/ssh/sshd_config → PasswordAuthentication no, PermitRootLogin no, затем systemctl restart ssh.

Порты Postgres (5432), Kong (8000), Studio (3000/8000) наружу не открываем — только 80/443 через nginx.

2.3. Docker Engine

curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
# перелогинься под deploy
2.4. Self-hosted Supabase

sudo mkdir -p /opt && sudo chown deploy:deploy /opt
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
mkdir supabase-stack && cd supabase-stack
cp -r ../supabase/docker/* .
cp ../supabase/docker/.env.example .env
Сгенерировать секреты

openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # JWT_SECRET (минимум 32 символа)
openssl rand -hex 32   # SECRET_KEY_BASE
openssl rand -hex 16   # VAULT_ENC_KEY (ровно 32 символа hex)
openssl rand -hex 16   # DASHBOARD_PASSWORD
ANON_KEY и SERVICE_ROLE_KEY — это JWT, подписанные твоим JWT_SECRET. Сгенерировать их можно на странице supabase.com/docs/guides/self-hosting#api-keys (генератор работает в браузере, секрет никуда не уходит) или локально любым JWT-инструментом с payload:


{"role":"anon","iss":"supabase","iat":<now>,"exp":<now + 10 лет>}
{"role":"service_role","iss":"supabase","iat":<now>,"exp":<now + 10 лет>}
Правки в /opt/supabase-stack/.env

POSTGRES_PASSWORD=<сгенерированный>
JWT_SECRET=<сгенерированный>
ANON_KEY=<JWT role=anon>
SERVICE_ROLE_KEY=<JWT role=service_role>
SECRET_KEY_BASE=<сгенерированный>
VAULT_ENC_KEY=<сгенерированный>

DASHBOARD_USERNAME=tutor
DASHBOARD_PASSWORD=<сгенерированный>

SITE_URL=https://bio.example.ru
API_EXTERNAL_URL=https://api.bio.example.ru
SUPABASE_PUBLIC_URL=https://api.bio.example.ru
ADDITIONAL_REDIRECT_URLS=https://bio.example.ru

# Ученики создаются репетитором через Admin API (app/(tutor)/tutor/students/actions.ts),
# публичная регистрация не нужна и её надо закрыть:
DISABLE_SIGNUP=true
# Подтверждение почты в проекте не используется (enable_confirmations=false локально),
# аккаунты создаются с email_confirm: true — SMTP не обязателен:
ENABLE_EMAIL_AUTOCONFIRM=true

# Лимит на файлы материалов — 50 MiB, как в config.toml и в миграции бакета:
FILE_SIZE_LIMIT=52428800
Ещё одна правка, обязательная по безопасности. В docker-compose.yml в секциях db и studio привяжи порты к localhost, чтобы Postgres и Studio не смотрели в интернет:


ports:
  - "127.0.0.1:${POSTGRES_PORT}:5432"
Поднять:


cd /opt/supabase-stack
docker compose pull
docker compose up -d
docker compose ps        # все healthy
Отдельно отмечу: supabase/config.toml из репозитория на этот стек никак не влияет — он конфигурирует только локальный CLI. В облаке всё настраивается через .env выше. Это легко перепутать.

2.5. Применить схему
Ставим Supabase CLI на сервер и пушим миграции — тогда история миграций (supabase_migrations.schema_migrations) будет корректной, и следующие деплои дойдут инкрементально.


cd /opt
git clone https://github.com/dimitri-d-morozov/tutor_website.git app
cd app

# CLI
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
  | sudo tar -xz -C /usr/local/bin supabase

# порт Postgres на хосте (обычно 5432)
docker compose -f /opt/supabase-stack/docker-compose.yml port db 5432

supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres"
seed.sql в продакшене не запускай. Он создаёт tutor@bio.local и учеников с паролем password123. supabase db push его и не трогает (его прогоняет только db reset) — просто не выполняй db reset на этой машине никогда.

Что уже создано миграциями и делать руками не надо: справочник отделов sections (20260806000004), приватный бакет materials (20260806000006), RLS и GRANT-ы.

Создать аккаунт репетитора
Studio наружу закрыт, поэтому зайди через SSH-туннель с ноутбука:


ssh -L 8000:127.0.0.1:8000 deploy@<IP>
# затем http://127.0.0.1:8000 → логин DASHBOARD_USERNAME / DASHBOARD_PASSWORD
В Studio: Authentication → Add user (email + пароль, «Auto Confirm User»). Триггер on_auth_user_created создаст строку в profiles с ролью student — переключи её в SQL Editor:


update profiles set role = 'tutor' where id = '<uuid нового пользователя>';
Дальше учеников репетитор добавляет сам из кабинета.

2.6. Запустить Next.js

# Node 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

cd /opt/app
npm ci
Создай /opt/app/.env.local (боевые значения — ключи из /opt/supabase-stack/.env):


NEXT_PUBLIC_SUPABASE_URL=https://api.bio.example.ru
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>

chmod 600 /opt/app/.env.local
npm run build
systemd-юнит /etc/systemd/system/tutor-web.service:


[Unit]
Description=BioPodgotovka Next.js
After=network.target docker.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/app
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target

sudo systemctl daemon-reload && sudo systemctl enable --now tutor-web
sudo systemctl status tutor-web
2.7. nginx + TLS
/etc/nginx/sites-available/tutor:


server {
    listen 80;
    server_name bio.example.ru;

    # 52 МБ — как bodySizeLimit в next.config.ts. Без этой строки загрузка
    # презентации оборвётся на nginx с 413 ещё до Server Action.
    client_max_body_size 52m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.bio.example.ru;

    client_max_body_size 52m;

    location / {
        proxy_pass http://127.0.0.1:8000;   # Kong
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

sudo ln -s /etc/nginx/sites-available/tutor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bio.example.ru -d api.bio.example.ru
Certbot сам добавит 443-блоки и редирект с 80, и поставит автопродление.

Закрой Studio от внешнего мира: в /opt/supabase-stack/docker-compose.yml у сервиса studio порт должен быть на 127.0.0.1, и в nginx его не проксируем — только SSH-туннель, как в 2.5.

2.8. Бэкапы
Персональные данные учеников, поэтому не опционально.


sudo tee /usr/local/bin/pg-backup.sh >/dev/null <<'EOF'
#!/bin/bash
set -euo pipefail
DIR=/var/backups/supabase && mkdir -p "$DIR"
STAMP=$(date +%F-%H%M)
docker compose -f /opt/supabase-stack/docker-compose.yml exec -T db \
  pg_dumpall -U postgres | gzip > "$DIR/db-$STAMP.sql.gz"
tar czf "$DIR/storage-$STAMP.tar.gz" -C /opt/supabase-stack/volumes storage
find "$DIR" -mtime +14 -delete
EOF
sudo chmod +x /usr/local/bin/pg-backup.sh
echo "17 3 * * * /usr/local/bin/pg-backup.sh" | sudo crontab -
Плюс включи снапшоты диска в панели Timeweb и раз в неделю забирай дамп на другую машину — бэкап, лежащий на том же диске, от потери диска не спасает.

2.9. Обновление после правок в коде

cd /opt/app
git pull
npm ci
supabase db push --db-url "postgresql://postgres:<PASSWORD>@127.0.0.1:5432/postgres"  # если были миграции
npm run build
sudo systemctl restart tutor-web
2.10. Чек-лист безопасности
 SUPABASE_SERVICE_ROLE_KEY — только в .env.local на сервере, без префикса NEXT_PUBLIC_, chmod 600. Он обходит RLS.
 DISABLE_SIGNUP=true — иначе кто угодно зарегистрируется и получит роль student.
 Studio и Postgres — только на 127.0.0.1, доступ через SSH-туннель.
 ufw: наружу только 22/80/443.
 seed.sql на прод не попадал; аккаунтов с password123 в базе нет.
 client_max_body_size 52m в обоих server-блоках.
 TLS есть, автопродление certbot проверено (certbot renew --dry-run).
 Дата-центр в РФ.
 Бэкапы идут и хотя бы раз восстанавливались на тестовой машине.
Два момента, которые стоит закрыть в самом репозитории: infra/docker-compose.yml из CLAUDE.md не существует, и нет .env.example. Могу добавить в проект .env.example, infra/docker-compose.yml (обёртку над официальным стеком), конфиг nginx и systemd-юнит — тогда весь деплой сведётся к «клонировать и заполнить .env». Скажи, если делать.