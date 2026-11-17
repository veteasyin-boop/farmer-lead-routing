import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isSameOriginRequest, verifyAdminSessionToken } from "@/lib/admin-auth";

export function adminGuard(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "आपका admin session समाप्त हो गया है। दोबारा लॉगिन करें।" }, { status: 401 });
  }
  if (request.method !== "GET" && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "अनुरोध अस्वीकार किया गया।" }, { status: 403 });
  }
  return null;
}

export function badRequest(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function safeError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("SUPABASE_URL")) return "सर्वर में Supabase environment variables सेट नहीं हैं।";
  return "सर्वर अनुरोध पूरा नहीं कर सका। कृपया दोबारा प्रयास करें।";
}
