"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";
import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";

const initialState: LoginState = { error: null };

/** Форма входа. `notice` — сообщение от middleware (например, профиль не найден). */
export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-xl">БиоПодготовка</span>
        </div>

        <h1 className="mb-1 font-display text-2xl">Вход</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Войдите в кабинет ученика или репетитора.
        </p>

        {notice && (
          <p className="mb-4 rounded-sm bg-coral-100 px-3 py-2 text-sm text-coral">
            {notice}
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-sm border border-border bg-surface px-3 py-2 outline-none focus:border-green-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Пароль</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="rounded-sm border border-border bg-surface px-3 py-2 outline-none focus:border-green-500"
            />
          </label>

          {state.error && <p className="text-sm text-coral">{state.error}</p>}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Входим…" : "Войти"}
          </Button>
        </form>

        {/* 152-ФЗ ст. 18.1 ч.2: политика должна быть общедоступна. Страница
            входа — единственный экран, который видит неавторизованный
            посетитель, поэтому ссылка живёт здесь. */}
        <p className="mt-6 border-t border-border pt-4 text-center text-xs text-ink-faint">
          <Link href="/privacy" className="hover:underline">
            Политика обработки персональных данных
          </Link>
        </p>
      </div>
    </div>
  );
}
