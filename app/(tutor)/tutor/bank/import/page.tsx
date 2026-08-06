import { requireRole } from "@/lib/auth";
import { TestImport } from "@/components/tutor/test-import";

export default async function ImportTestPage() {
  await requireRole("tutor");
  return <TestImport />;
}
