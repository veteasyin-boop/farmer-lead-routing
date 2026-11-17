import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { applyLeadFilters } from "@/lib/admin-data";
import { LeadUpdateSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 50)));
    const filters = {
      retailerId: params.get("retailerId") || undefined,
      distributorId: params.get("distributorId") || undefined,
      adSource: params.get("adSource") || undefined,
      status: params.get("status") || undefined,
      district: params.get("district") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    };
    const client = supabaseAdmin();
    const query = applyLeadFilters(
      client.from("leads").select(`id,created_at,farmer_name,phone,product,quantity,village,pincode,district,ad_source,retailer_id,distributor_id,status,notes,retailer:retailers!leads_retailer_id_fkey(id,name,phone),distributor:retailers!leads_distributor_id_fkey(id,name,phone)`, { count: "exact" }),
      filters,
    ).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    const { data, count, error } = await query;
    if (error) throw error;
    return NextResponse.json({ leads: data ?? [], total: count ?? 0, page, pageSize });
  } catch (error) {
    console.error("admin_leads_fetch_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "अमान्य अनुरोध।" }, { status: 400 }); }
  const parsed = LeadUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "लीड अपडेट की जानकारी सही नहीं है।" }, { status: 400 });

  const { leadId, ...changes } = parsed.data;
  if (Object.keys(changes).length === 0) return NextResponse.json({ error: "अपडेट करने के लिए कोई बदलाव नहीं है।" }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (changes.status !== undefined) update.status = changes.status;
  if (changes.notes !== undefined) update.notes = changes.notes;

  try {
    const client = supabaseAdmin();
    if (changes.retailerId !== undefined && changes.retailerId !== null) {
      const { data: retailer, error: retailerError } = await client.from("retailers")
        .select("id").eq("id", changes.retailerId).eq("type", "retailer").eq("active", true).maybeSingle();
      if (retailerError) throw retailerError;
      if (!retailer) return NextResponse.json({ error: "सिर्फ active retailer को lead assign कर सकते हैं।" }, { status: 400 });
    }
    if (changes.retailerId !== undefined) update.retailer_id = changes.retailerId;
    const { data, error } = await client.from("leads").update(update).eq("id", leadId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "लीड नहीं मिली।" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("admin_lead_update_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
