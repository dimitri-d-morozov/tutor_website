"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { logout } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/cn";

export type NavItem = { label: string; href: string };

/** Боковая навигация (тёмно-зелёный сайдбар 250px из мокапов). */
export function Sidebar({
  nav,
  user,
}: {
  nav: NavItem[];
  user: { name: string; subtitle: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col bg-green-900 p-5 text-white">
      <div className="mb-8 flex items-center gap-3">
        <BrandMark />
        <span className="font-display text-lg">БиоПодготовка</span>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-amber-600 font-medium text-green-900"
                  : "text-white/80 hover:bg-green-700",
              )}
            >
              <span
                className={cn(
                  "hex block h-2.5 w-2.5",
                  active ? "bg-green-900" : "bg-amber-600",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-md bg-green-700/40 p-3">
        <div className="text-sm font-medium">{user.name}</div>
        <div className="text-xs text-white/60">{user.subtitle}</div>
        <form action={logout}>
          <button
            type="submit"
            className="mt-2 text-xs text-white/60 underline underline-offset-2 transition-colors hover:text-white"
          >
            Выйти
          </button>
        </form>
      </div>
    </aside>
  );
}
