import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ access_token: string }> };

const labels: Record<string, string> = { new: "नई", sent: "भेजी गई", contacted: "संपर्क हुआ", delivered: "डिलीवर", no_response: "जवाब नहीं" };

export default async function RetailerPortal({ params }: Props) {
  const { access_token } = await params;
  if (!/^[a-f0-9]{64}$/.test(access_token)) notFound();

  const client = supabaseAdmin();
  const { data: retailer, error: retailerError } = await client.from("retailers")
    .select("id,name,phone,village,district,type,active")
    .eq("access_token", access_token).eq("type", "retailer").eq("active", true).maybeSingle();
  if (retailerError || !retailer) notFound();

  const { data: leads, error } = await client.from("leads")
    .select("id,created_at,farmer_name,phone,product,quantity,village,pincode,district,status")
    .eq("retailer_id", retailer.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Retailer leads could not be loaded.");

  return (
    <main className="min-h-[100svh] px-4 py-5 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <header className="panel mb-4 p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf5ed] text-2xl">🌾</span><div><p className="text-xs font-semibold text-[#237348]">Retailer Lead Portal</p><h1 className="text-xl font-extrabold">{retailer.name}</h1><p className="mt-1 text-xs muted">{retailer.village}, {retailer.district}</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f5f8f4] p-3"><p className="text-xs muted">कुल दिख रही leads</p><p className="mt-1 text-2xl font-extrabold">{leads?.length ?? 0}</p></div><div className="rounded-xl bg-[#f5f8f4] p-3"><p className="text-xs muted">आपका संपर्क नंबर</p><a className="mt-1 inline-block font-bold text-[#237348]" href={`tel:${retailer.phone}`}>{retailer.phone}</a></div></div>
        </header>

        <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">आपको दी गई किसान leads</h2><span className="text-xs muted">Read only</span></div>
        {!leads || leads.length === 0 ? <div className="panel p-8 text-center text-sm muted">अभी कोई लीड नहीं है।</div> : <div className="space-y-3">{leads.map((lead) => <article key={lead.id} className="panel p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{lead.farmer_name}</p><a className="mt-1 inline-flex min-h-11 items-center text-lg font-extrabold text-[#237348] underline" href={`tel:${lead.phone}`}>☎ {lead.phone}</a></div><span className="shrink-0 rounded-full bg-[#edf5ed] px-2.5 py-1 text-xs font-semibold text-[#237348]">{labels[lead.status] ?? lead.status}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><p className="text-[11px] muted">उत्पाद</p><p className="font-semibold">{lead.product}</p></div><div><p className="text-[11px] muted">मात्रा</p><p className="font-semibold">{lead.quantity}</p></div><div><p className="text-[11px] muted">गाँव</p><p className="font-semibold">{lead.village}</p></div><div><p className="text-[11px] muted">पिनकोड / जिला</p><p className="font-semibold">{lead.pincode} · {lead.district || "—"}</p></div></div>
          <p className="mt-3 text-[11px] muted">{new Date(lead.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          <a className="btn-primary mt-3 min-h-11 w-full" href={`tel:${lead.phone}`}>किसान को कॉल करें</a>
        </article>)}</div>}
      </div>
    </main>
  );
}
