import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LeadInputSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return NextResponse.json({ ok: false, error: "अनुरोध बहुत बड़ा है।" }, { status: 413 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "फॉर्म की जानकारी पढ़ी नहीं जा सकी।" }, { status: 400 });
  }

  const parsed = LeadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "कृपया सभी जानकारी सही तरीके से भरें।" }, { status: 400 });
  }

  const ip = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "सेवा अभी उपलब्ध नहीं है। कृपया बाद में प्रयास करें।" }, { status: 503 });
  }
  const requestBucketKey = createHmac("sha256", secret).update(ip).digest("hex");
  const lead = parsed.data;

  try {
    const { data, error } = await supabaseAdmin().rpc("create_farmer_lead", {
      p_farmer_name: lead.farmerName,
      p_phone: lead.phone,
      p_product: lead.product,
      p_quantity: lead.quantity,
      p_village: lead.village,
      p_pincode: lead.pincode,
      p_lat: lead.lat ?? null,
      p_lng: lead.lng ?? null,
      p_ad_source: lead.adSource || "organic",
      p_request_bucket_key: requestBucketKey,
    });

    if (error) throw error;
    const result = data as { ok?: boolean; code?: string } | null;
    if (!result?.ok && result?.code === "duplicate") {
      return NextResponse.json({ ok: false, error: "इस मोबाइल नंबर और उत्पाद का अनुरोध पिछले 24 घंटे में पहले ही दर्ज हो चुका है।" }, { status: 409 });
    }
    if (!result?.ok && result?.code === "rate_limited") {
      return NextResponse.json({ ok: false, error: "बहुत अधिक अनुरोध भेजे गए हैं। कुछ मिनट बाद दोबारा प्रयास करें।" }, { status: 429 });
    }
    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: "अनुरोध दर्ज नहीं हो पाया। कृपया दोबारा प्रयास करें।" }, { status: 500 });
    }

    // Deliberately return no retailer/distributor details to the public form.
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("lead_submission_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "अभी अनुरोध दर्ज नहीं हो पाया। कृपया दोबारा प्रयास करें।" }, { status: 500 });
  }
}
