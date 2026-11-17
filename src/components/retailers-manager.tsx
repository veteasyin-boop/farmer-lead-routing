"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Retailer = {
  id: string; name: string; phone: string; type: "retailer" | "distributor"; village: string; district: string;
  pincode: string; lat: number | null; lng: number | null; active: boolean; access_token: string;
};
type FormData = {
  id: string; name: string; phone: string; type: "retailer" | "distributor"; village: string; district: string;
  pincode: string; lat: string; lng: string; active: boolean;
};
const empty: FormData = { id: "", name: "", phone: "", type: "retailer", village: "", district: "", pincode: "", lat: "", lng: "", active: true };

export function RetailersManager() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [form, setForm] = useState<FormData>(empty);
  const [retailerFile, setRetailerFile] = useState<File | null>(null);
  const [pincodeFile, setPincodeFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/retailers", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    const data = await response.json() as { retailers?: Retailer[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Retailer सूची नहीं मिली।");
    setRetailers(data.retailers ?? []);
  }, []);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "डेटा लोड नहीं हुआ।")); }, [load]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function edit(item: Retailer) {
    setForm({ id: item.id, name: item.name, phone: item.phone, type: item.type, village: item.village, district: item.district, pincode: item.pincode, lat: item.lat == null ? "" : String(item.lat), lng: item.lng == null ? "" : String(item.lng), active: item.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = {
        ...form,
        lat: form.lat.trim() ? Number(form.lat) : null,
        lng: form.lng.trim() ? Number(form.lng) : null,
        ...(form.id ? { id: form.id } : {}),
      };
      delete (payload as Partial<typeof payload>).id;
      const response = await fetch("/api/admin/retailers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ...(form.id ? { id: form.id } : {}) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Retailer सेव नहीं हुआ।");
      setNotice(form.id ? "Retailer अपडेट हो गया।" : "Retailer जोड़ दिया गया।");
      setForm(empty);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retailer सेव नहीं हुआ।");
    } finally { setBusy(false); }
  }

  async function upload(kind: "retailers" | "pincodes") {
    const file = kind === "retailers" ? retailerFile : pincodeFile;
    if (!file) { setError("पहले CSV फ़ाइल चुनें।"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch(kind === "retailers" ? "/api/admin/retailers/import" : "/api/admin/pincodes/import", { method: "POST", body: data });
      const result = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "CSV import नहीं हुआ।");
      setNotice(`${result.imported ?? 0} ${kind === "retailers" ? "retailers" : "pincodes"} import हो गए।`);
      if (kind === "retailers") { setRetailerFile(null); await load(); }
      else setPincodeFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CSV import नहीं हुआ।");
    } finally { setBusy(false); }
  }

  function retailerLink(token: string) { return `${window.location.origin}/r/${token}`; }

  return (
    <main className="mx-auto max-w-[1200px] space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <div><h1 className="text-2xl font-extrabold">Retailers & distributors</h1><p className="mt-1 text-sm muted">जोड़ें, edit करें, CSV import करें और retailer portal link साझा करें।</p></div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-bold">{form.id ? "Retailer edit करें" : "नया retailer / distributor"}</h2>{form.id && <button className="text-sm font-semibold text-[#237348]" onClick={() => setForm(empty)}>Cancel edit</button>}</div>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-[#63746a]">नाम<input className="field mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} /></label>
          <label className="text-xs font-semibold text-[#63746a]">मोबाइल नंबर<input className="field mt-1" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} required /></label>
          <label className="text-xs font-semibold text-[#63746a]">Type<select className="field mt-1" value={form.type} onChange={(e) => set("type", e.target.value as FormData["type"])}><option value="retailer">Retailer</option><option value="distributor">Distributor</option></select></label>
          <label className="text-xs font-semibold text-[#63746a]">गाँव<input className="field mt-1" value={form.village} onChange={(e) => set("village", e.target.value)} required /></label>
          <label className="text-xs font-semibold text-[#63746a]">जिला<input className="field mt-1" value={form.district} onChange={(e) => set("district", e.target.value)} required /></label>
          <label className="text-xs font-semibold text-[#63746a]">पिनकोड<input className="field mt-1" inputMode="numeric" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
          <label className="text-xs font-semibold text-[#63746a]">Latitude<input className="field mt-1" inputMode="decimal" placeholder="जैसे 25.5941" value={form.lat} onChange={(e) => set("lat", e.target.value)} /></label>
          <label className="text-xs font-semibold text-[#63746a]">Longitude<input className="field mt-1" inputMode="decimal" placeholder="जैसे 85.1376" value={form.lng} onChange={(e) => set("lng", e.target.value)} /></label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3"><button type="submit" className="btn-primary" disabled={busy}>{busy ? "सेव हो रहा है…" : form.id ? "Update करें" : "जोड़ें"}</button><button type="button" className="btn-secondary" onClick={() => setForm(empty)}>Form साफ़ करें</button></div>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <h2 className="font-bold">Retailers CSV import</h2>
          <p className="mt-1 text-xs muted">नए records जोड़ें। Required columns: name, phone, type, village, district, pincode. Optional: lat, lng, active.</p>
          <a className="mt-2 inline-block text-xs font-semibold text-[#237348] underline" href="/retailers-template.csv" download>Sample CSV डाउनलोड करें</a>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="field min-w-0" type="file" accept=".csv,text/csv" onChange={(e) => setRetailerFile(e.target.files?.[0] ?? null)} /><button className="btn-primary shrink-0" disabled={busy || !retailerFile} onClick={() => void upload("retailers")}>Import</button></div>
        </div>
        <div className="panel p-4 sm:p-5">
          <h2 className="font-bold">Pincode coordinates import</h2>
          <p className="mt-1 text-xs muted">GPS अस्वीकार होने पर pincode से location निकालने के लिए coordinates डालें। Columns: pincode, lat, lng, district.</p>
          <a className="mt-2 inline-block text-xs font-semibold text-[#237348] underline" href="/pincodes-template.csv" download>Sample CSV डाउनलोड करें</a>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="field min-w-0" type="file" accept=".csv,text/csv" onChange={(e) => setPincodeFile(e.target.files?.[0] ?? null)} /><button className="btn-primary shrink-0" disabled={busy || !pincodeFile} onClick={() => void upload("pincodes")}>Import</button></div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e0e8df] px-4 py-4"><h2 className="font-bold">All partners ({retailers.length})</h2><button className="btn-secondary text-xs" onClick={() => void load()}>Refresh</button></div>
        <div className="table-wrap"><table>
          <thead><tr><th>नाम / Type</th><th>मोबाइल</th><th>स्थान</th><th>Geo</th><th>Status</th><th>Retailer portal</th><th>Action</th></tr></thead>
          <tbody>{retailers.map((item) => <tr key={item.id}>
            <td><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs muted">{item.type}</p></td>
            <td><a className="font-semibold text-[#237348] underline" href={`tel:${item.phone}`}>{item.phone}</a></td>
            <td>{item.village}, {item.district}<p className="mt-1 text-xs muted">{item.pincode}</p></td>
            <td className="text-xs">{item.lat != null && item.lng != null ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : "नहीं दिया"}</td>
            <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{item.active ? "Active" : "Inactive"}</span></td>
            <td>{item.type === "retailer" ? <button className="text-xs font-semibold text-[#237348] underline" onClick={() => void navigator.clipboard.writeText(retailerLink(item.access_token)).then(() => setNotice("Retailer portal link कॉपी हो गया।"))}>Link कॉपी करें</button> : <span className="text-xs muted">लागू नहीं</span>}</td>
            <td><button className="btn-secondary text-xs" onClick={() => edit(item)}>Edit</button></td>
          </tr>)}</tbody>
        </table></div>
        {retailers.length === 0 && <p className="p-6 text-center text-sm muted">अभी कोई partner दर्ज नहीं है।</p>}
      </section>
    </main>
  );
}
