import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { applyLeadFilters } from "@/lib/admin-data";
import { toCsv } from "@/lib/csv";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const params = request.nextUrl.searchParams;
    const retailerId = params.get("retailerId") || undefined;
    if (!retailerId) return NextResponse.json({ error: "CSV export के लिए retailer चुनें।" }, { status: 400 });
    const filters = {
      retailerId,
      distributorId: params.get("distributorId") || undefined,
      adSource: params.get("adSource") || undefined,
      status: params.get("status") || undefined,
      district: params.get("district") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    };
    const query = applyLeadFilters(
      supabaseAdmin().from("leads").select("id,created_at,farmer_name,phone,product,quantity,village,pincode,district,ad_source,status,notes,distributor:retailers!leads_distributor_id_fkey(name)"),
      filters,
    ).order("created_at", { ascending: false }).limit(5000);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []).map((lead: any) => ({
      id: lead.id,
      created_at: lead.created_at,
      farmer_name: lead.farmer_name,
      phone: lead.phone,
      product: lead.product,
      quantity: lead.quantity,
      village: lead.village,
      pincode: lead.pincode,
      district: lead.district,
      ad_source: lead.ad_source,
      status: lead.status,
      distributor: lead.distributor?.name ?? "",
      notes: lead.notes,
    }));
    const body = `\uFEFF${toCsv(rows, ["id", "created_at", "farmer_name", "phone", "product", "quantity", "village", "pincode", "district", "ad_source", "status", "distributor", "notes"])}`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="retailer-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("admin_export_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
