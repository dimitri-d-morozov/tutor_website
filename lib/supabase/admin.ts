import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Supabase-клиент с service-role ключом: ОБХОДИТ RLS.
 *
 * Использовать только в Server Actions и только после явной проверки роли
 * (`requireRole("tutor")` из lib/auth.ts) — сам клиент ничего не проверяет.
 * Нужен для двух вещей, которые обычному клиенту недоступны:
 *   1. создание аккаунтов учеников (Admin API);
 *   2. файлы материалов — на storage.objects нет ни одной разрешающей политики,
 *      поэтому загрузку и подписанные ссылки выдаёт только этот клиент.
 *
 * Ключ читается из SUPABASE_SERVICE_ROLE_KEY (без NEXT_PUBLIC_), так что
 * в браузерный бандл не попадает.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Не задан SUPABASE_SERVICE_ROLE_KEY — возьмите значение из `supabase status` и добавьте в .env.local",
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
