import { redirect } from "next/navigation";

/**
 * У репетитора отдельного дашборда нет: главный экран — список учеников
 * (как в мокапе tutor_portal.html, где «Ученики» — первый пункт навигации).
 * Роут оставлен, потому что middleware отправляет всех на /{role}/dashboard.
 */
export default function TutorDashboard() {
  redirect("/tutor/students");
}
