import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { RetailerInputSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const { data, error } = await supabaseAdmin().from("retailers")
      .select("id,name,phone,type,village,district,pincode,lat,lng,active,access_token")
      .order("type").order("name");
    if (error) throw error;
    return NextResponse.json({ retailers: data ?? [] });
  } catch (error) {
    console.error("retailers_fetch_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "अमान्य अनुरोध।" }, { status: 400 }); }
  const parsed = RetailerInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "कृपया सभी retailer विवरण सही भरें।" }, { status: 400 });

  const { id, ...values } = parsed.data;
  const payload = {
    name: values.name,
    phone: values.phone,
    type: values.type,
    village: values.village,
    district: values.district,
    pincode: values.pincode,
    lat: values.lat ?? null,
    lng: values.lng ?? null,
    active: values.active,
  };

  try {
    const query = id
      ? supabaseAdmin().from("retailers").update(payload).eq("id", id)
      : supabaseAdmin().from("retailers").insert(payload);
    const { data, error } = await query.select("id,name,phone,type,access_token").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, retailer: data }, { status: id ? 200 : 201 });
  } catch (error) {
    console.error("retailer_save_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
