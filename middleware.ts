import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware: обновляет сессию Supabase и разводит пользователей по ролям.
 *   - неавторизованный → /login
 *   - авторизованный на /login или / → /{role}/dashboard
 *   - ученик в зоне /tutor/* (и наоборот) → редирект в свою зону
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  // Политика обработки персональных данных обязана быть доступна без входа:
  // 152-ФЗ ст. 18.1 ч.2 требует «неограниченного доступа» к ней, а её должен
  // прочитать в том числе родитель, у которого аккаунта нет и не будет.
  const isPublic = isLogin || path === "/privacy";

  // Не авторизован — пускаем только на публичные страницы.
  if (!user) {
    if (isPublic) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Авторизован — определяем роль.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Профиль не прочитался (нет строки, не хватает GRANT-а, упала RLS).
  // Роль тут угадывать нельзя: layout всё равно сделает redirect на /login,
  // а middleware отправит обратно на дашборд — получится цикл редиректов.
  // Поэтому показываем страницу входа с явной ошибкой.
  if (!profile) {
    if (isPublic) return response;
    return NextResponse.redirect(new URL("/login?error=no-profile", request.url));
  }

  const role = profile.role;
  const home = `/${role}/dashboard`;

  // С /login или корня — на свой дашборд.
  if (isLogin || path === "/") {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Запрет чужой зоны.
  const otherArea = role === "tutor" ? "/student" : "/tutor";
  if (path === otherArea || path.startsWith(otherArea + "/")) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  // Исключаем статику Next.js и файлы с расширением.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
