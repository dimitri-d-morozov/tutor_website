import { requireRole } from "@/lib/auth";
import { Sidebar, type NavItem } from "@/components/ui/sidebar";

// Отдельного дашборда нет: главный экран репетитора — список учеников
// (/tutor/dashboard редиректит на него).
const nav: NavItem[] = [
  { label: "Ученики", href: "/tutor/students" },
  { label: "Материалы", href: "/tutor/materials" },
  { label: "Темы", href: "/tutor/topics" },
  { label: "Программы", href: "/tutor/courses" },
  { label: "Тесты", href: "/tutor/bank" },
];

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("tutor");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nav={nav}
        user={{
          name: profile.full_name || "Репетитор",
          subtitle: "Репетитор по биологии",
        }}
      />
      <main className="mx-auto w-full max-w-[1080px] flex-1 px-11 py-9">
        {children}
      </main>
    </div>
  );
}
