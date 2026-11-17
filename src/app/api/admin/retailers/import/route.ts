import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { csvRecords } from "@/lib/csv";
import { supabaseAdmin } from "@/lib/supabase";
import { RetailerInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size > 2_000_000) return NextResponse.json({ error: "2 MB से छोटी CSV फ़ाइल चुनें।" }, { status: 400 });
    const records = csvRecords(await file.text());
    if (records.length === 0 || records.length > 2000) return NextResponse.json({ error: "CSV में 1 से 2000 rows होनी चाहिए।" }, { status: 400 });
    const rows = [];
    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      const parsed = RetailerInputSchema.safeParse({
        name: row.name,
        phone: row.phone,
        type: row.type,
        village: row.village,
        district: row.district,
        pincode: row.pincode,
        lat: row.lat !== undefined && row.lat !== "" ? Number(row.lat) : null,
        lng: row.lng !== undefined && row.lng !== "" ? Number(row.lng) : null,
        active: row.active ? ["true", "1", "yes", "active"].includes(row.active.toLowerCase()) : true,
      });
      if (!parsed.success) return NextResponse.json({ error: `CSV row ${index + 2} में जानकारी गलत है।` }, { status: 400 });
      const { id: _ignoredId, ...values } = parsed.data;
      rows.push({ ...values, access_token: randomBytes(32).toString("hex") });
    }

    const { data, error } = await supabaseAdmin().from("retailers").insert(rows).select("id");
    if (error) throw error;
    return NextResponse.json({ ok: true, imported: data?.length ?? 0 }, { status: 201 });
  } catch (error) {
    console.error("retailer_import_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
