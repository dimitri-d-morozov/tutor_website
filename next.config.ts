import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // По умолчанию тело Server Action ограничено 1 МБ — презентации не пролезут.
      // 52 МБ = лимит бакета materials (50 MiB) + запас на multipart-обвязку.
      // Сам размер файла проверяем и в форме, и на сервере: этот лимит нужен,
      // чтобы вместо внятной ошибки не приходил обрыв запроса.
      bodySizeLimit: "52mb",
    },
    // Next.js 16: отдельный лимит для middleware (по умолчанию 10mb).
    middlewareClientMaxBodySize: "52mb",
  },
};

export default nextConfig;
