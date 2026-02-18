# Why Data Saves Locally & Vanishes on Refresh

## 1. Why Data "Vanishes"
It wasn't disappearing! The app was simply **trying to connect to Supabase** for 5-10 seconds. During that time, it showed nothing. After failing, it showed your local data.
I have increased the timeout to **30 seconds** to give slow databases a chance to wake up.

**Result**: If you refresh now, **wait 30 seconds**. If the database fails, your data will appear from local storage.

## 2. Why It Saves Locally (Not in Database)
You see "Account saved locally" because your computer cannot reach Supabase. This happens due to:
- **Network Issues**: Firewalls or ad-blockers sometimes block Supabase.
- **Cold Starts**: Free-tier databases fall asleep.
- **Configuration**: Although you ran the SQL, ensure you pasted the **CODE** (not filename) into the editor.

## Solution

1. **Wait**: Refresh and give it 30s.
2. **Fix Database**: Copy the SQL code from `walkthrough.md` (which I updated) and run it in Supabase.
