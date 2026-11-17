import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminSessionToken, isSameOriginRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "अनुरोध अस्वीकार किया गया।" }, { status: 403 });
  const configured = process.env.ADMIN_PASSWORD?.trim();
  if (!configured || configured.length < 16) {
    return NextResponse.json({ error: "Vercel में कम से कम 16 अक्षरों का ADMIN_PASSWORD सेट करें।" }, { status: 503 });
  }

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "अमान्य अनुरोध।" }, { status: 400 }); }
  const password = typeof input === "object" && input !== null && "password" in input && typeof input.password === "string" ? input.password : "";
  const expected = Buffer.from(configured);
  const supplied = Buffer.from(password);
  const valid = expected.length === supplied.length && timingSafeEqual(expected, supplied);
  const ip = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const rateLimitKey = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || configured)
    .update(`admin-login:${ip}`).digest("hex");
  try {
    const { data, error } = await supabaseAdmin().rpc("check_admin_login_rate_limit", { p_request_bucket_key: rateLimitKey });
    if (error) throw error;
    if (data !== true) return NextResponse.json({ error: "बहुत अधिक प्रयास हुए हैं। 15 मिनट बाद दोबारा प्रयास करें।" }, { status: 429 });
  } catch (error) {
    console.error("admin_login_rate_limit_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "लॉगिन सेवा अस्थायी रूप से उपलब्ध नहीं है।" }, { status: 503 });
  }
  if (!valid) return NextResponse.json({ error: "पासवर्ड सही नहीं है।" }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return response;
}
