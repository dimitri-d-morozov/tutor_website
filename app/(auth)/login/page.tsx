import { LoginForm } from "./login-form";

const notices: Record<string, string> = {
  "no-profile":
    "Аккаунт есть, но профиль не читается — проверьте, что для роли authenticated выданы GRANT-ы и не блокирует RLS.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return <LoginForm notice={error ? notices[error] : undefined} />;
}
