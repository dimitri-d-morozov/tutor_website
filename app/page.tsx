import { redirect } from "next/navigation";

// Корень: middleware обычно перенаправляет раньше, но на всякий случай — на вход.
export default function Home() {
  redirect("/login");
}
