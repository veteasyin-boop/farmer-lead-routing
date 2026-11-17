import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const denied = adminGuard(request);
  if (denied) return denied;
  const { id } = await context.params;

  try {
    const client = supabaseAdmin();
    const { data: retailer, error: retailerError } = await client.from("retailers")
      .select("id,name,phone,type").eq("id", id).eq("type", "retailer").maybeSingle();
    if (retailerError) throw retailerError;
    if (!retailer) return NextResponse.json({ error: "Retailer नहीं मिला।" }, { status: 404 });

    const { data: leads, error } = await client.rpc("claim_retailer_pending_leads", { p_retailer_id: id, p_limit: 20 });
    if (error) throw error;
    if (!leads || leads.length === 0) return NextResponse.json({ error: "इस retailer के लिए कोई pending lead नहीं है।" }, { status: 404 });

    const message = [
      `नमस्ते ${retailer.name} जी, आपके लिए किसान leads:`,
      ...leads.map((lead: { farmer_name: string; phone: string; product: string; quantity: string; village: string; pincode: string }, index: number) =>
        `${index + 1}. ${lead.farmer_name} | ${lead.phone} | ${lead.product} (${lead.quantity}) | ${lead.village}, ${lead.pincode}`),
      "कृपया किसान से जल्द संपर्क करें।",
    ].join("\n");
    const digits = retailer.phone.replace(/\D/g, "");
    const waPhone = digits.length === 10 ? `91${digits}` : digits;
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
    return NextResponse.json({ ok: true, url, count: leads.length, limit: 20 });
  } catch (error) {
    console.error("retailer_whatsapp_build_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
