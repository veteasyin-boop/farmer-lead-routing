import { redirect } from "next/navigation";
import { isAdminPageRequest } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-nav";
import { RetailersManager } from "@/components/retailers-manager";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function RetailersPage() {
  if (!(await isAdminPageRequest())) redirect("/admin/login");
  return <><AdminNav active="retailers" /><RetailersManager /></>;
}
