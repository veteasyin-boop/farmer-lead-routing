-- Farmer Lead Routing schema
-- Run this migration only in a dedicated Supabase project.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  type text not null check (type in ('retailer', 'distributor')),
  village text not null,
  district text not null,
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  active boolean not null default true,
  access_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex')
);

create table if not exists public.pincodes (
  pincode text primary key check (pincode ~ '^[0-9]{6}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  district text
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  farmer_name text not null,
  phone text not null check (phone ~ '^[0-9]{10}$'),
  product text not null,
  quantity text not null,
  village text not null,
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  district text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  ad_source text not null default 'organic',
  retailer_id uuid references public.retailers(id) on delete set null,
  distributor_id uuid references public.retailers(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'sent', 'contacted', 'delivered', 'no_response')),
  notes text not null default ''
);

create table if not exists public.lead_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null default 1 check (hit_count >= 0)
);

create index if not exists retailers_active_type_idx on public.retailers(type, active);
create index if not exists retailers_geo_idx on public.retailers(lat, lng) where active = true;
create index if not exists lead_rate_limits_window_started_idx on public.lead_rate_limits(window_started_at);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_phone_product_created_idx on public.leads(phone, lower(product), created_at desc);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_retailer_created_idx on public.leads(retailer_id, created_at desc);
create index if not exists leads_distributor_created_idx on public.leads(distributor_id, created_at desc);
create index if not exists leads_ad_source_idx on public.leads(ad_source);
create index if not exists leads_district_idx on public.leads(district);

alter table public.retailers enable row level security;
alter table public.pincodes enable row level security;
alter table public.leads enable row level security;
alter table public.lead_rate_limits enable row level security;

revoke all on table public.retailers, public.pincodes, public.leads, public.lead_rate_limits from anon, authenticated;
grant all on table public.retailers, public.pincodes, public.leads, public.lead_rate_limits to service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;

create or replace function public.find_nearest_active_retailer(p_lat double precision, p_lng double precision)
returns uuid language sql stable set search_path = public, pg_temp
as $$
  select r.id from public.retailers r
  where r.type = 'retailer' and r.active = true and r.lat is not null and r.lng is not null
  order by (6371.0 * 2.0 * asin(least(1.0, sqrt(greatest(0.0,
    power(sin(radians(r.lat - p_lat) / 2.0), 2) +
    cos(radians(p_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - p_lng) / 2.0), 2)
  ))))) asc limit 1;
$$;

create or replace function public.find_nearest_active_distributor(p_lat double precision, p_lng double precision)
returns uuid language sql stable set search_path = public, pg_temp
as $$
  select r.id from public.retailers r
  where r.type = 'distributor' and r.active = true and r.lat is not null and r.lng is not null
  order by (6371.0 * 2.0 * asin(least(1.0, sqrt(greatest(0.0,
    power(sin(radians(r.lat - p_lat) / 2.0), 2) +
    cos(radians(p_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - p_lng) / 2.0), 2)
  ))))) asc limit 1;
$$;

create or replace function public.create_farmer_lead(
  p_farmer_name text, p_phone text, p_product text, p_quantity text, p_village text, p_pincode text,
  p_lat double precision default null, p_lng double precision default null,
  p_ad_source text default 'organic', p_request_bucket_key text default null
)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_lat double precision := p_lat;
  v_lng double precision := p_lng;
  v_district text;
  v_pin_lat double precision;
  v_pin_lng double precision;
  v_retailer_id uuid;
  v_distributor_id uuid;
  v_existing_id uuid;
  v_lead_id uuid;
  v_hits integer;
  v_window_seconds integer := 600;
begin
  if p_request_bucket_key is not null then
    delete from public.lead_rate_limits where window_started_at < now() - interval '1 day';
    insert into public.lead_rate_limits(bucket_key, window_started_at, hit_count)
    values (p_request_bucket_key, now(), 1)
    on conflict (bucket_key) do update
      set window_started_at = case when public.lead_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds) then now() else public.lead_rate_limits.window_started_at end,
          hit_count = case when public.lead_rate_limits.window_started_at <= now() - make_interval(secs => v_window_seconds) then 1 else public.lead_rate_limits.hit_count + 1 end
    returning hit_count into v_hits;
    if v_hits > 12 then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;
  end if;

  select p.lat, p.lng, p.district into v_pin_lat, v_pin_lng, v_district
  from public.pincodes p where p.pincode = p_pincode;
  v_lat := coalesce(v_lat, v_pin_lat);
  v_lng := coalesce(v_lng, v_pin_lng);

  if v_lat is not null and v_lng is not null then
    v_retailer_id := public.find_nearest_active_retailer(v_lat, v_lng);
    v_distributor_id := public.find_nearest_active_distributor(v_lat, v_lng);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_phone || ':' || lower(trim(p_product)), 0));
  select l.id into v_existing_id from public.leads l
  where l.phone = p_phone and lower(trim(l.product)) = lower(trim(p_product))
    and l.created_at >= now() - interval '24 hours'
  order by l.created_at desc limit 1;
  if v_existing_id is not null then return jsonb_build_object('ok', false, 'code', 'duplicate', 'leadId', v_existing_id); end if;

  insert into public.leads (farmer_name, phone, product, quantity, village, pincode, district, lat, lng, ad_source, retailer_id, distributor_id, status)
  values (trim(p_farmer_name), p_phone, trim(p_product), trim(p_quantity), trim(p_village), p_pincode,
    v_district, v_lat, v_lng, coalesce(nullif(trim(p_ad_source), ''), 'organic'), v_retailer_id, v_distributor_id, 'new')
  returning id into v_lead_id;

  return jsonb_build_object('ok', true, 'leadId', v_lead_id,
    'retailerAssigned', v_retailer_id is not null, 'distributorAssigned', v_distributor_id is not null,
    'locationResolved', v_lat is not null and v_lng is not null);
end;
$$;

create or replace function public.claim_retailer_pending_leads(p_retailer_id uuid, p_limit integer default 20)
returns table (id uuid, farmer_name text, phone text, product text, quantity text, village text, pincode text, created_at timestamptz)
language sql security invoker set search_path = public, pg_temp
as $$
  with pending as (
    select l.id from public.leads l where l.retailer_id = p_retailer_id and l.status in ('new', 'no_response')
    order by l.created_at asc limit least(greatest(coalesce(p_limit, 20), 1), 20) for update skip locked
  ), updated as (
    update public.leads l set status = 'sent' from pending p where l.id = p.id
    returning l.id, l.farmer_name, l.phone, l.product, l.quantity, l.village, l.pincode, l.created_at
  )
  select * from updated order by updated.created_at asc;
$$;

create or replace function public.get_farmer_lead_stats()
returns jsonb language sql stable security invoker set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'byAdSource', coalesce((select jsonb_agg(jsonb_build_object('label', x.ad_source, 'count', x.total) order by x.total desc)
      from (select coalesce(nullif(ad_source, ''), 'organic') as ad_source, count(*)::bigint as total from public.leads group by 1) x), '[]'::jsonb),
    'byRetailer', coalesce((select jsonb_agg(jsonb_build_object('label', x.label, 'count', x.total) order by x.total desc)
      from (select coalesce(r.name, 'असाइन नहीं') as label, count(*)::bigint as total from public.leads l left join public.retailers r on r.id = l.retailer_id group by 1) x), '[]'::jsonb),
    'byDistrict', coalesce((select jsonb_agg(jsonb_build_object('label', x.label, 'count', x.total) order by x.total desc)
      from (select coalesce(nullif(district, ''), 'अज्ञात') as label, count(*)::bigint as total from public.leads group by 1) x), '[]'::jsonb)
  );
$$;

create or replace function public.check_admin_login_rate_limit(p_request_bucket_key text)
returns boolean language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_hits integer;
begin
  delete from public.lead_rate_limits where window_started_at < now() - interval '1 day';
  insert into public.lead_rate_limits(bucket_key, window_started_at, hit_count)
  values ('admin:' || p_request_bucket_key, now(), 1)
  on conflict (bucket_key) do update
    set window_started_at = case when public.lead_rate_limits.window_started_at <= now() - interval '15 minutes' then now() else public.lead_rate_limits.window_started_at end,
        hit_count = case when public.lead_rate_limits.window_started_at <= now() - interval '15 minutes' then 1 else public.lead_rate_limits.hit_count + 1 end
  returning hit_count into v_hits;
  return v_hits <= 10;
end;
$$;

revoke all on function public.find_nearest_active_retailer(double precision, double precision) from public, anon, authenticated;
revoke all on function public.find_nearest_active_distributor(double precision, double precision) from public, anon, authenticated;
revoke all on function public.create_farmer_lead(text, text, text, text, text, text, double precision, double precision, text, text) from public, anon, authenticated;
revoke all on function public.claim_retailer_pending_leads(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_farmer_lead_stats() from public, anon, authenticated;
revoke all on function public.check_admin_login_rate_limit(text) from public, anon, authenticated;
grant execute on function public.find_nearest_active_retailer(double precision, double precision) to service_role;
grant execute on function public.find_nearest_active_distributor(double precision, double precision) to service_role;
grant execute on function public.create_farmer_lead(text, text, text, text, text, text, double precision, double precision, text, text) to service_role;
grant execute on function public.claim_retailer_pending_leads(uuid, integer) to service_role;
grant execute on function public.get_farmer_lead_stats() to service_role;
grant execute on function public.check_admin_login_rate_limit(text) to service_role;
