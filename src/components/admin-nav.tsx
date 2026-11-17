"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminNav({ active }: { active: "leads" | "retailers" }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[#e0e8df] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#237348] text-lg text-white">🌾</span>
          <div>
            <p className="text-sm font-extrabold">Farmer Lead Routing</p>
            <p className="text-[11px] muted">Master Admin</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link className={`rounded-lg px-3 py-2 text-sm font-semibold ${active === "leads" ? "bg-[#edf5ed] text-[#237348]" : "text-[#64746a] hover:bg-[#f4f7f3]"}`} href="/admin">Leads</Link>
          <Link className={`rounded-lg px-3 py-2 text-sm font-semibold ${active === "retailers" ? "bg-[#edf5ed] text-[#237348]" : "text-[#64746a] hover:bg-[#f4f7f3]"}`} href="/admin/retailers">Retailers</Link>
          <button onClick={logout} className="btn-secondary ml-1 px-3 py-2 text-xs">Logout</button>
        </nav>
      </div>
    </header>
  );
}
