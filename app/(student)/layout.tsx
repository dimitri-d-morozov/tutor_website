import { requireRole } from "@/lib/auth";
import { Sidebar, type NavItem } from "@/components/ui/sidebar";

const nav: NavItem[] = [
  { label: "Дашборд", href: "/student/dashboard" },
  { label: "План занятий", href: "/student/lessons" },
  { label: "Все материалы", href: "/student/materials" },
  { label: "Тесты", href: "/student/tests" },
  { label: "Работа над ошибками", href: "/student/mistakes" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("student");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nav={nav}
        user={{ name: profile.full_name || "Ученик", subtitle: "Ученик" }}
      />
      <main className="mx-auto w-full max-w-[980px] flex-1 px-11 py-9">
        {children}
      </main>
    </div>
  );
}
