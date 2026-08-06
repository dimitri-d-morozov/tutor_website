import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MATERIALS_BUCKET } from "@/lib/materials";

/**
 * Открыть материал: редиректит на внешнюю ссылку или на подписанную ссылку файла.
 *
 * Авторизация — на RLS, а не на проверке роли: читаем материал клиентом текущего
 * пользователя, и если политика materials_select строку не отдала, значит доступа
 * нет. Поэтому один и тот же эндпоинт годится и репетитору (видит всё), и ученику
 * (видит только материалы своих пройденных занятий) — без дублирования правил в коде.
 *
 * Подписанная ссылка живёт 60 секунд: её хватает на редирект, но переслать её
 * однокласснику уже не получится.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("storage_path, external_url")
    .eq("id", id)
    .maybeSingle();

  if (!material) {
    return NextResponse.json(
      { error: "Материал не найден или недоступен" },
      { status: 404 },
    );
  }

  if (material.external_url) {
    return NextResponse.redirect(material.external_url);
  }

  if (!material.storage_path || material.storage_path === "pending") {
    return NextResponse.json(
      { error: "У материала нет файла" },
      { status: 404 },
    );
  }

  const { data: signed, error } = await createAdminClient()
    .storage.from(MATERIALS_BUCKET)
    .createSignedUrl(material.storage_path, 60);

  if (error || !signed) {
    return NextResponse.json(
      { error: "Не удалось получить ссылку на файл" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
