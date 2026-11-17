import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { csvRecords } from "@/lib/csv";
import { supabaseAdmin } from "@/lib/supabase";
import { PincodeInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size > 5_000_000) return NextResponse.json({ error: "5 MB से छोटी CSV फ़ाइल चुनें।" }, { status: 400 });
    const records = csvRecords(await file.text());
    if (records.length === 0 || records.length > 10000) return NextResponse.json({ error: "CSV में 1 से 10000 rows होनी चाहिए।" }, { status: 400 });
    const rows = [];
    for (let index = 0; index < records.length; index += 1) {
      const parsed = PincodeInputSchema.safeParse(records[index]);
      if (!parsed.success) return NextResponse.json({ error: `CSV row ${index + 2} में जानकारी गलत है।` }, { status: 400 });
      rows.push(parsed.data);
    }
    const { data, error } = await supabaseAdmin().from("pincodes").upsert(rows, { onConflict: "pincode" }).select("pincode");
    if (error) throw error;
    return NextResponse.json({ ok: true, imported: data?.length ?? rows.length }, { status: 201 });
  } catch (error) {
    console.error("pincode_import_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
