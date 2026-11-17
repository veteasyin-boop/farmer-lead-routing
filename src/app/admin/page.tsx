import { redirect } from "next/navigation";
import { isAdminPageRequest } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdminPageRequest())) redirect("/admin/login");
  return <><AdminNav active="leads" /><AdminDashboard /></>;
}
