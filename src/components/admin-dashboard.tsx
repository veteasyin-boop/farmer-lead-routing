"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Retailer = { id: string; name: string; phone: string; type: "retailer" | "distributor"; active: boolean; access_token?: string };
type Lead = {
  id: string; created_at: string; farmer_name: string; phone: string; product: string; quantity: string;
  village: string; pincode: string; district: string | null; ad_source: string; retailer_id: string | null;
  distributor_id: string | null; status: string; notes: string;
  retailer?: { id: string; name: string; phone: string } | null;
  distributor?: { id: string; name: string; phone: string } | null;
};
type Stat = { label: string; count: number };
type Filters = { retailerId: string; distributorId: string; adSource: string; status: string; district: string; from: string; to: string };

const emptyFilters: Filters = { retailerId: "", distributorId: "", adSource: "", status: "", district: "", from: "", to: "" };
const statusLabels: Record<string, string> = { new: "नई", sent: "भेजी गई", contacted: "संपर्क हुआ", delivered: "डिलीवर", no_response: "जवाब नहीं" };

export function AdminDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ total: number; byAdSource: Stat[]; byRetailer: Stat[]; byDistrict: Stat[] } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingWhatsApp, setPendingWhatsApp] = useState<string | null>(null);
  const [fallbackWhatsAppUrl, setFallbackWhatsAppUrl] = useState("");
  const pageSize = 50;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
    return params.toString();
  }, [filters, page]);

  const loadRetailers = useCallback(async () => {
    const response = await fetch("/api/admin/retailers", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/admin/login"; return; }
    const result = await response.json() as { retailers?: Retailer[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Retailer सूची नहीं मिली।");
    setRetailers(result.retailers ?? []);
  }, []);

  const loadStats = useCallback(async () => {
    const response = await fetch("/api/admin/stats", { cache: "no-store" });
    const result = await response.json() as { total?: number; byAdSource?: Stat[]; byRetailer?: Stat[]; byDistrict?: Stat[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Stats नहीं मिले।");
    setStats({ total: result.total ?? 0, byAdSource: result.byAdSource ?? [], byRetailer: result.byRetailer ?? [], byDistrict: result.byDistrict ?? [] });
  }, []);

  const loadLeads = useCallback(async (silent = false) => {
    if (!silent) setBusy(true);
    try {
      const response = await fetch(`/api/admin/leads?${queryString}`, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/admin/login"; return; }
      const result = await response.json() as { leads?: Lead[]; total?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "लीड लोड नहीं हुई।");
      setLeads(result.leads ?? []);
      setTotal(result.total ?? 0);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "लीड लोड नहीं हुई।");
    } finally {
      if (!silent) setBusy(false);
    }
  }, [queryString]);

  useEffect(() => {
    Promise.all([loadRetailers(), loadStats()]).catch((caught) => setError(caught instanceof Error ? caught.message : "डेटा लोड नहीं हुआ।"));
  }, [loadRetailers, loadStats]);

  useEffect(() => {
    void loadLeads();
    const timer = window.setInterval(() => { void loadLeads(true); void loadStats(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadLeads, loadStats]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function updateLead(leadId: string, changes: Record<string, unknown>) {
    setNotice("");
    const response = await fetch("/api/admin/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, ...changes }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setError(result.error || "लीड अपडेट नहीं हुई।"); return false; }
    setNotice("लीड अपडेट हो गई।");
    await loadLeads(true);
    await loadStats();
    return true;
  }

  async function sendWhatsApp(retailer: Retailer) {
    const popup = window.open("about:blank", "_blank");
    setPendingWhatsApp(retailer.id);
    setFallbackWhatsAppUrl("");
    setError("");
    try {
      const response = await fetch(`/api/admin/retailers/${retailer.id}/whatsapp`, { method: "POST" });
      const result = await response.json() as { url?: string; count?: number; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "WhatsApp लिंक नहीं बन पाया।");
      if (popup) {
        popup.location.href = result.url;
        popup.opener = null;
      } else {
        setFallbackWhatsAppUrl(result.url);
      }
      setNotice(`${result.count ?? 0} pending leads को sent किया गया। WhatsApp भेजने के बाद पुष्टि करें।`);
      await loadLeads(true);
      await loadStats();
    } catch (caught) {
      popup?.close();
      setError(caught instanceof Error ? caught.message : "WhatsApp लिंक नहीं बन पाया।");
    } finally {
      setPendingWhatsApp(null);
    }
  }

  function exportUrl(retailerId: string) {
    const params = new URLSearchParams({ retailerId });
    Object.entries(filters).forEach(([key, value]) => { if (key !== "retailerId" && value) params.set(key, String(value)); });
    return `/api/admin/export?${params.toString()}`;
  }

  const retailerRows = retailers.filter((retailer) => retailer.type === "retailer");
  const distributorRows = retailers.filter((retailer) => retailer.type === "distributor");

  return (
    <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">लीड मैनेजमेंट</h1><p className="mt-1 text-sm muted">सभी farmer requests · हर 30 सेकंड में auto-refresh</p></div>
        <button onClick={() => { void loadLeads(); void loadStats(); }} className="btn-secondary">↻ Refresh</button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
      {fallbackWhatsAppUrl && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">Popup blocked. <a className="font-bold underline" href={fallbackWhatsAppUrl} target="_blank" rel="noopener noreferrer">WhatsApp खोलें</a></div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4"><p className="text-xs muted">कुल लीड</p><p className="stat-value mt-2">{stats?.total ?? "—"}</p></div>
        <div className="panel p-4"><p className="text-xs muted">इस फ़िल्टर में</p><p className="stat-value mt-2">{total}</p></div>
        <div className="panel p-4"><p className="text-xs muted">Active retailers</p><p className="stat-value mt-2">{retailerRows.filter((item) => item.active).length}</p></div>
        <div className="panel p-4"><p className="text-xs muted">Active distributors</p><p className="stat-value mt-2">{distributorRows.filter((item) => item.active).length}</p></div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">फ़िल्टर</h2><button onClick={() => { setFilters(emptyFilters); setPage(1); }} className="text-sm font-semibold text-[#237348]">सभी हटाएँ</button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-[#63746a]">Retailer<select className="field mt-1" value={filters.retailerId} onChange={(e) => setFilter("retailerId", e.target.value)}><option value="">सभी retailers</option>{retailerRows.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#63746a]">Distributor<select className="field mt-1" value={filters.distributorId} onChange={(e) => setFilter("distributorId", e.target.value)}><option value="">सभी distributors</option>{distributorRows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#63746a]">Ad source<input className="field mt-1" placeholder="जैसे mustard1" value={filters.adSource} onChange={(e) => setFilter("adSource", e.target.value)} /></label>
          <label className="text-xs font-semibold text-[#63746a]">Status<select className="field mt-1" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}><option value="">सभी status</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#63746a]">District<input className="field mt-1" placeholder="जिला" value={filters.district} onChange={(e) => setFilter("district", e.target.value)} /></label>
          <label className="text-xs font-semibold text-[#63746a]">From date<input className="field mt-1" type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} /></label>
          <label className="text-xs font-semibold text-[#63746a]">To date<input className="field mt-1" type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} /></label>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e8df] px-4 py-4 sm:px-5">
          <div><h2 className="font-bold">सभी लीड</h2><p className="text-xs muted">Newest first · {total} records</p></div>
          <p className="text-xs muted">नोट्स सेव करने के लिए field से बाहर क्लिक करें।</p>
        </div>
        {busy ? <div className="p-8 text-center text-sm muted">लीड लोड हो रही हैं…</div> : leads.length === 0 ? <div className="p-8 text-center text-sm muted">इस फ़िल्टर में कोई लीड नहीं मिली।</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>समय / किसान</th><th>संपर्क</th><th>उत्पाद / मात्रा</th><th>स्थान</th><th>Retailer</th><th>Distributor</th><th>Ad source</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>{leads.map((lead) => (
                <tr key={lead.id}>
                  <td><p className="font-semibold text-[#203d2d]">{lead.farmer_name}</p><p className="mt-1 text-[11px] muted">{new Date(lead.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></td>
                  <td><a className="font-bold text-[#237348] underline" href={`tel:${lead.phone}`}>{lead.phone}</a></td>
                  <td><p className="font-semibold">{lead.product}</p><p className="mt-1 text-xs muted">{lead.quantity}</p></td>
                  <td><p>{lead.village}</p><p className="mt-1 text-xs muted">{lead.district || "—"} · {lead.pincode}</p></td>
                  <td><select aria-label={`Retailer for ${lead.farmer_name}`} className="field min-h-9 w-40 py-1 text-xs" value={lead.retailer_id ?? ""} onChange={(e) => void updateLead(lead.id, { retailerId: e.target.value || null })}><option value="">असाइन नहीं</option>{retailerRows.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                  <td><span>{lead.distributor?.name ?? "—"}</span></td>
                  <td><span className="rounded-md bg-[#f2f5f1] px-2 py-1 text-xs">{lead.ad_source}</span></td>
                  <td><select aria-label={`Status for ${lead.farmer_name}`} className="field min-h-9 w-32 py-1 text-xs" value={lead.status} onChange={(e) => void updateLead(lead.id, { status: e.target.value })}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
                  <td><input aria-label={`Notes for ${lead.farmer_name}`} className="field min-h-9 w-44 py-1 text-xs" defaultValue={lead.notes ?? ""} key={`${lead.id}-${lead.notes}`} placeholder="नोट लिखें" maxLength={2000} onBlur={(e) => { if (e.target.value !== (lead.notes ?? "")) void updateLead(lead.id, { notes: e.target.value }); }} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-[#e0e8df] px-4 py-3 sm:px-5">
          <p className="text-xs muted">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</p>
          <div className="flex gap-2"><button className="btn-secondary text-sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>पहले</button><button className="btn-secondary text-sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((value) => value + 1)}>अगले</button></div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-4"><h2 className="font-bold">Retailer actions</h2><p className="mt-1 text-xs muted">Export में ऊपर चुने गए filters लागू होंगे। WhatsApp में अधिकतम 20 pending leads भेजने के लिए message बनेगा।</p></div>
        {retailerRows.length === 0 ? <p className="text-sm muted">अभी retailer दर्ज नहीं है।</p> : <div className="divide-y divide-[#edf1ec]">{retailerRows.map((retailer) => <div key={retailer.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="font-semibold">{retailer.name}</p><p className="text-xs muted">{retailer.phone} · {retailer.active ? "Active" : "Inactive"}</p></div><div className="flex flex-wrap gap-2"><a className="btn-secondary text-xs" href={exportUrl(retailer.id)}>CSV डाउनलोड</a><button className="btn-primary text-xs" disabled={!retailer.active || pendingWhatsApp === retailer.id} onClick={() => void sendWhatsApp(retailer)}>{pendingWhatsApp === retailer.id ? "बन रहा है…" : "WhatsApp पर भेजें"}</button></div></div>)}</div>}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Analytics</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <StatCard title="Leads per ad" rows={stats?.byAdSource ?? []} />
          <StatCard title="Leads per retailer" rows={stats?.byRetailer ?? []} />
          <StatCard title="Leads per district" rows={stats?.byDistrict ?? []} />
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, rows }: { title: string; rows: Stat[] }) {
  return <div className="panel p-4"><h3 className="mb-3 text-sm font-bold">{title}</h3>{rows.length === 0 ? <p className="text-xs muted">डेटा उपलब्ध नहीं है।</p> : <div className="space-y-3">{rows.slice(0, 8).map((row) => <div key={row.label}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate">{row.label || "—"}</span><strong>{row.count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#edf2ec]"><div className="h-full rounded-full bg-[#3b8b5e]" style={{ width: `${Math.min(100, Math.max(2, (row.count / Math.max(1, rows[0].count)) * 100))}%` }} /></div></div>)}</div>}</div>;
}
