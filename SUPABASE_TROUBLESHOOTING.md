# Supabase “did not respond in 10s” – fix from Supabase side

If you see **“Supabase did not respond in 10s”** or **“Saved locally”**, the app cannot reach your Supabase project. Do these steps **in the Supabase Dashboard** and in your project.

---

## 1. Restore project if it is paused (very common)

- Open **[Supabase Dashboard](https://supabase.com/dashboard)** and select your project.
- If you see **“Project is paused”** or **“Restore project”**, click **Restore project**.
- Wait until the project is fully active. Paused projects do not accept API requests, so the app will time out.

---

## 2. Get the correct URL and anon key

- In the dashboard go to **Project Settings** (gear icon) → **API**.
- **Project URL**  
  - Copy the **Project URL** (e.g. `https://msovbaassriztctcrozl.supabase.co`).  
  - In your app this must be set as **`VITE_SUPABASE_URL`** in `.env` (no spaces before the name).

- **anon public key**  
  - In the same **API** section, find the key named **“anon”** or **“anon public”** (used in the browser).
  - It is usually a **long JWT** (starts with `eyJ...`).  
  - Copy it and set it in `.env` as **`VITE_SUPABASE_ANON_KEY`** (no spaces before the name).  
  - Do **not** use the **service_role** key in the frontend.

If your key does **not** start with `eyJ...`, double-check you copied the **anon public** key, not another field.

---

## 3. Set your `.env` file (app side)

In the project root, in **`.env`** (or **`.env.local`**), you must have:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your_anon_key_here...
```

- No spaces before `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`.
- Replace with your real Project URL and anon key from step 2.
- Save the file, then **restart the dev server** (stop and run `npm run dev` again). Env is read only at startup.

---

## 4. Run the SQL fix in Supabase (tables + RLS)

- In Supabase go to **SQL Editor** → **New query**.
- Open the file **`supabase-fix-smtp-timeout.sql`** in this project, copy **all** of it, paste into the editor, then click **Run**.
- This creates/fixes the `smtp_accounts` table and RLS so the app can read/write SMTP accounts.

---

## 5. Check from the app (browser)

- Restart the app (`npm run dev`), open **Settings**, try to add an SMTP account again.
- Open **F12 → Console**. You should see something like:
  - `[saveSmtp] supabaseUrl: https://xxxx...supabase.co...`  
  If you see `supabaseUrl: NOT SET`, the app is not loading env: fix `.env` and restart.
- Open **F12 → Network**. When you click **Save**, you should see a request to `https://YOUR_REF.supabase.co/rest/...`.  
  - If there is **no** request, the URL/key are wrong or not loaded.  
  - If the request is **pending** for a long time, the project may be paused or there is a network/firewall issue.

---

## Summary checklist

| Step | Where | Action |
|------|--------|--------|
| 1 | Supabase Dashboard | If project is paused → **Restore project** |
| 2 | Supabase → Project Settings → API | Copy **Project URL** and **anon public** key (JWT `eyJ...`) |
| 3 | Your project `.env` | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (no leading spaces), then **restart dev server** |
| 4 | Supabase → SQL Editor | Run **`supabase-fix-smtp-timeout.sql`** |
| 5 | Browser F12 | Confirm URL in console and request to Supabase in Network tab |

Until Supabase responds, the app will **save SMTP accounts locally** so you can keep using it; once the steps above are done, saving will sync to Supabase as well.
