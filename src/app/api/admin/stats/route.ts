import { NextRequest, NextResponse } from "next/server";
import { adminGuard, safeError } from "@/lib/admin-api";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;
  try {
    const { data, error } = await supabaseAdmin().rpc("get_farmer_lead_stats");
    if (error) throw error;
    const { count, error: countError } = await supabaseAdmin().from("leads").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    return NextResponse.json({ ...(data as Record<string, unknown>), total: count ?? 0 });
  } catch (error) {
    console.error("admin_stats_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
