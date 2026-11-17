# Farmer Lead Routing

Hindi-first, mobile-first farmer lead capture with server-side nearest retailer/distributor assignment, a password-protected master admin, retailer read-only portal, CSV import/export, and click-to-open WhatsApp messages.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL (`@supabase/supabase-js` service role on server only)
- Vercel deployment

No WhatsApp Cloud API, SMS, n8n, browser Supabase key, or client-side database access is used.

## Assumptions and operating rules

1. A lead is matched by straight-line Haversine distance between farmer coordinates and active partner coordinates. The nearest active `retailer` and nearest active `distributor` are selected independently.
2. GPS is optional. If GPS is absent, `pincodes` is used to resolve the farmer's coordinates and district. When a pincode is not loaded, the lead is still saved with no automatic assignment so it is not lost; admin can manually assign a retailer.
3. Duplicate means the same 10-digit phone and case-insensitive product within the previous 24 hours. PostgreSQL advisory locks make this check atomic.
4. WhatsApp action claims and marks up to 20 `new` or `no_response` leads as `sent`, then creates a `wa.me` URL. The admin must still press Send in WhatsApp. Leads beyond 20 remain pending for the next batch.
5. Retailer portal links are bearer links. Anyone possessing the 256-bit token can read that retailer's leads; deactivate the retailer to revoke access.
6. Admin session expires after 12 hours. `ADMIN_PASSWORD` must be at least 16 characters. Admin login is throttled to 10 attempts per 15-minute window per keyed IP hash.

## Environment variables

Set these in Vercel for Production, Preview, and Development as required:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_SECRET
ADMIN_PASSWORD=replace-with-a-long-random-password-at-least-16-characters
```

Never set the service role key under a `NEXT_PUBLIC_` name. Do not commit `.env` files.

## 1. Create a dedicated Supabase project

Do not use an existing production database containing unrelated tables called `retailers` or `leads`.

1. Create a new Supabase project in the organization you selected.
2. Prefer the Mumbai region (`ap-south-1`) for an initial Bihar deployment.
3. Open SQL Editor and run `supabase/migrations/0001_farmer_lead_routing.sql` in full.
4. Verify tables and functions exist: `retailers`, `pincodes`, `leads`, `lead_rate_limits`, `find_nearest_active_retailer`, `find_nearest_active_distributor`, `create_farmer_lead`, `claim_retailer_pending_leads`, `get_farmer_lead_stats`.
5. Copy Project URL and the service role **secret** key into Vercel project environment variables. Keep the key server-side only.

## 2. Load partner and pincode data

In `/admin/retailers` after deployment:

- Import retailer and distributor rows with `retailers-template.csv` as a shape example. `type` must be exactly `retailer` or `distributor`. Provide accurate `lat` and `lng` for reliable nearest assignment.
- Import pincode centroids using `pincodes-template.csv` as a shape example. The sample values are illustrative only; replace them with verified coordinates before real use.
- Pincode CSV columns: `pincode,lat,lng,district`. The template contains headers only; append verified centroid rows before import.
- Retailer CSV columns: `name,phone,type,village,district,pincode,lat,lng,active`. The template contains headers only; append real partner records before import.

The project does not invent pincode coordinates or retailer records. Without a loaded pincode row and without farmer GPS, that lead will be stored but will remain unassigned until an admin reassigns it.

## 3. Local development

Node.js 20.9+ is required.

```bash
cp .env.example .env.local
# Fill the three values in .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Admin: `http://localhost:3000/admin`.

## 4. GitHub + Vercel

1. Push this project to the `main` branch of the connected GitHub repository.
2. In Vercel, import the GitHub repository and keep Framework Preset `Next.js` and Root Directory `.`.
3. Add the three environment variables above to Production, Preview, and Development.
4. Deploy the `main` branch. Confirm the deployment reaches `Ready`.
5. Open `/admin/login`, enter the value configured as `ADMIN_PASSWORD`, and import partner and pincode datasets.
6. Test one real farmer submission before sharing ads.

## Ad links

Use the deployed origin with an `ad` query value:

- `https://YOUR-APP.vercel.app/?ad=mustard1`
- `https://YOUR-APP.vercel.app/?ad=wheat_video_01`
- `https://YOUR-APP.vercel.app/?ad=facebook_nov`

The `ad` value is stored as `leads.ad_source`.

## Routes

| Route | Purpose |
|---|---|
| `/` | Hindi farmer lead form |
| `/admin/login` | Admin password login |
| `/admin` | Leads, filters, actions, analytics |
| `/admin/retailers` | Retailer/distributor management and CSV imports |
| `/r/[access_token]` | Read-only retailer portal |
| `POST /api/lead` | Validated, rate-limited, atomically assigned lead submission |
| `/api/admin/leads` | Admin lead list and updates |
| `/api/admin/export` | Filtered retailer CSV export |

## Verification checklist

- [ ] Anonymous PostgREST requests to all four tables are denied.
- [ ] Farmer submission inserts one lead and assigns the nearest active retailer/distributor when coordinates are available.
- [ ] Same phone + same product inside 24 hours returns HTTP 409 and inserts no second row.
- [ ] Different product or phone can create a separate lead.
- [ ] GPS denied + loaded pincode resolves location and district.
- [ ] GPS denied + unknown pincode saves an unassigned lead; admin can reassign it.
- [ ] Public success view renders only `आपका ऑर्डर मिल गया, जल्द संपर्क किया जाएगा`.
- [ ] Admin unauthenticated requests return 401; password login sets HttpOnly, SameSite=Strict cookie.
- [ ] Admin filters, status/notes changes, retailer reassignment, CSV import/export, and 30-second refresh work.
- [ ] WhatsApp action marks only the claimed batch of pending leads as `sent`; the browser opens `wa.me` and the user sends manually.
- [ ] Inactive retailer token returns 404; active token only shows that retailer's leads.

## Security notes

- Service role key exists only in server runtime and is never returned by an API.
- RLS is enabled on all tables. `anon` and `authenticated` have no table grants or RPC execution grants; no policies are created for them.
- The retailer URL token is a bearer credential; do not publish it in public pages or campaign ads.
- Admin mutations require an admin cookie and same-origin browser requests.
- Lead submissions are limited to 12 per IP-hash per 10-minute window in Postgres, plus atomic duplicate protection.
- For large-volume campaigns, add a managed bot challenge/WAF and monitor rate-limit rejections. The in-database IP key is a keyed hash, not a raw IP.

## Notes on scaling

Lead table filters are indexed. Admin reads are paginated (50 rows per page); exports are capped at 5,000 rows per file. The WhatsApp message batch is capped at 20 leads to avoid oversized URL payloads. For larger operations, queue exports and send smaller WhatsApp batches.
