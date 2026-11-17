# Farmer Lead Routing

A Hindi-first farmer lead intake and routing application built with Next.js and Supabase.

## Setup

1. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_PASSWORD`.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.
4. Apply `supabase/migrations/` to a dedicated Supabase project.

Never expose the service-role key to browser code. All database operations must execute on the server.
