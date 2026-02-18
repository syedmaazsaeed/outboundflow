# Supabase Dashboard Checklist for OutboundFlow

Yes. You need to set up your Supabase project so the app (and SMTP account save) works. Do the following in the **Supabase Dashboard**.

---

## Quick fix for "Supabase request timed out" when saving SMTP

1. Open **Supabase Dashboard** → **SQL Editor** → **New query**.
2. Copy the entire contents of **`supabase-fix-smtp-timeout.sql`** and paste into the editor.
3. Click **Run**.
4. Try saving an SMTP account again in the app.

That script creates/fixes the `smtp_accounts` table and RLS policies so inserts complete instead of hanging.

---

## 1. Create tables and RLS (one-time)

In **SQL Editor** → **New query**, run the schema that creates tables and policies:

- **First time / fresh project:** run **`supabase-schema.sql`** (full schema).
- If you already have some tables, run **`supabase-schema-idempotent.sql`** if you have it, or apply the missing parts from **`supabase-schema.sql`** (tables + RLS section).

The app expects at least these tables:

- `public.users`
- `public.smtp_accounts` ← **critical for saving SMTP accounts**
- `public.campaigns`
- `public.sequence_steps`
- `public.leads`
- `public.campaign_accounts`
- `public.email_messages`
- `public.execution_logs`
- `public.lead_folders`
- `public.campaign_analytics`

---

## 2. Row Level Security (RLS) on `smtp_accounts`

SMTP save uses the **anon** key with the **logged-in user’s JWT**. RLS must allow that user to read/write their own rows.

In **Table Editor** → **smtp_accounts** → **Policies** (or **Authentication** → **Policies**), ensure **RLS is enabled** and these policies exist:

| Policy name                         | Operation | Rule (USING / WITH CHECK)   |
|-------------------------------------|-----------|-----------------------------|
| Users can view own smtp accounts    | SELECT    | `auth.uid() = user_id`      |
| Users can insert own smtp accounts  | INSERT    | `auth.uid() = user_id`      |
| Users can update own smtp accounts   | UPDATE    | `auth.uid() = user_id`      |
| Users can delete own smtp accounts   | DELETE    | `auth.uid() = user_id`      |

If any are missing, run this in **SQL Editor** (from `supabase-schema.sql`):

```sql
ALTER TABLE public.smtp_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own smtp accounts" ON public.smtp_accounts;
DROP POLICY IF EXISTS "Users can insert own smtp accounts" ON public.smtp_accounts;
DROP POLICY IF EXISTS "Users can update own smtp accounts" ON public.smtp_accounts;
DROP POLICY IF EXISTS "Users can delete own smtp accounts" ON public.smtp_accounts;

CREATE POLICY "Users can view own smtp accounts" ON public.smtp_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own smtp accounts" ON public.smtp_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smtp accounts" ON public.smtp_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own smtp accounts" ON public.smtp_accounts
    FOR DELETE USING (auth.uid() = user_id);
```

---

## 3. `smtp_accounts` table columns

In **Table Editor** → **smtp_accounts**, confirm the columns match what the app sends:

- `id` (uuid, primary key, default `uuid_generate_v4()`)
- `user_id` (uuid, NOT NULL, references `public.users(id)`)
- `label`, `host`, `port`, `user_name`, `pass`, `secure`, `from_email`
- `warmup_enabled`, `warmup_sent_today`, `daily_send_limit`, `sent_today`, `last_reset_date`
- `created_at`, `updated_at`

If `user_name` or any column is missing, add it (or run the relevant part of `supabase-schema.sql`).

---

## 4. Auth and `public.users`

- **Authentication** → **Providers:** Email (and optionally others) enabled.
- **Authentication** → **URL Configuration:** set **Site URL** (e.g. `http://localhost:3000` for dev).
- After a user signs up, a row in **`public.users`** must exist with `id = auth.uid()`. The app creates it on sign-up/sign-in; if you use a different auth flow, ensure that row exists.

---

## 5. Env in the app

In your app env (e.g. `.env` or `.env.local`):

- `VITE_SUPABASE_URL` = your project URL (Project Settings → API).
- `VITE_SUPABASE_ANON_KEY` = the **anon public** key (Project Settings → API).

Use the **anon** key in the frontend (the app uses it with the user’s JWT; RLS enforces `auth.uid() = user_id`).

---

## 6. Optional: verify from dashboard

- **Table Editor** → **smtp_accounts**: after a successful save, you should see a new row with your `user_id`.
- **Logs** (e.g. API or Postgres): check for 403/RLS errors if save still fails.

---

## Summary

| Where              | What to do |
|--------------------|------------|
| SQL Editor         | Run `supabase-schema.sql` (or idempotent) so tables + RLS exist. |
| smtp_accounts RLS  | Enable RLS; add SELECT/INSERT/UPDATE/DELETE with `auth.uid() = user_id`. |
| Table Editor       | Confirm `smtp_accounts` has the columns above. |
| Authentication     | Site URL and providers set; `public.users` row per user. |
| App env            | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. |

If SMTP save still times out after 5–7 minutes, the request may be blocked or very slow: check **Logs** in the dashboard for failed or slow requests and RLS/403 errors.
