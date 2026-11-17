"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "लॉगिन नहीं हो पाया।");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("नेटवर्क त्रुटि। दोबारा प्रयास करें।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-4 py-10">
      <section className="panel w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf3e9] text-2xl">🔐</div>
        <h1 className="text-2xl font-extrabold">Master Admin</h1>
        <p className="mt-1 text-sm muted">प्रशासन पैनल खोलने के लिए पासवर्ड दर्ज करें।</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">Admin password</label>
            <input id="password" type="password" autoComplete="current-password" className="field" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={busy || password.length === 0}>{busy ? "लॉगिन हो रहा है…" : "लॉगिन करें"}</button>
        </form>
      </section>
    </main>
  );
}
