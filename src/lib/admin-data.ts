import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadFilters = {
  retailerId?: string;
  distributorId?: string;
  adSource?: string;
  status?: string;
  district?: string;
  from?: string;
  to?: string;
};

export function applyLeadFilters(query: any, filters: LeadFilters): any {
  let next = query;
  if (filters.retailerId) next = next.eq("retailer_id", filters.retailerId);
  if (filters.distributorId) next = next.eq("distributor_id", filters.distributorId);
  if (filters.adSource) next = next.ilike("ad_source", `%${filters.adSource}%`);
  if (filters.status) next = next.eq("status", filters.status);
  if (filters.district) next = next.ilike("district", `%${filters.district}%`);
  if (filters.from) next = next.gte("created_at", new Date(`${filters.from}T00:00:00+05:30`).toISOString());
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00+05:30`);
    end.setUTCDate(end.getUTCDate() + 1);
    next = next.lt("created_at", end.toISOString());
  }
  return next;
}

export async function fetchRetailerLabels(client: SupabaseClient) {
  const { data, error } = await client.from("retailers").select("id,name,type,phone,active").order("name");
  if (error) throw error;
  return data ?? [];
}
