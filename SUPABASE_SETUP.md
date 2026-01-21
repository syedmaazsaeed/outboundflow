# Supabase Integration Setup Guide

This guide will walk you through setting up Supabase for the OutboundFlow application.

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: OutboundFlow (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is sufficient to start

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (a long JWT token)

## Step 3: Set Up Environment Variables

Create a `.env.local` file in the root directory of your project (same level as `package.json`) with the following:

```env
# Google Gemini API Key (optional)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Replace:
- `your_gemini_api_key_here` with your Gemini API key (if you have one)
- `https://your-project-id.supabase.co` with your Project URL
- `your_anon_key_here` with your anon public key

## Step 4: Run the Database Schema

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open the `supabase-schema.sql` file from this project
4. Copy and paste the entire contents into the SQL Editor
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

This will create:
- All necessary tables (users, campaigns, leads, smtp_accounts, email_messages, execution_logs, sequence_steps)
- Indexes for better performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates

## Step 5: Configure Authentication & Email

The application uses Supabase Auth for secure authentication. You need to configure email settings for:
- User sign up verification emails
- Password reset emails

### Configure Email Settings

1. In your Supabase project dashboard, go to **Authentication** → **Email Templates**
2. Customize email templates if desired (optional)
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL** to your application URL (e.g., `http://localhost:3000` for development)
5. Add redirect URLs:
   - `http://localhost:3000/reset-password` (for development)
   - `https://yourdomain.com/reset-password` (for production)

### Email Provider Setup

**For Development:**
- Supabase provides a default email service (limited to 3 emails/hour)
- This is sufficient for testing

**For Production:**
- Go to **Settings** → **Auth** → **SMTP Settings**
- Configure your SMTP provider (Gmail, SendGrid, Mailgun, etc.)
- This allows unlimited emails and better deliverability

## Step 6: Create Initial Admin User (Optional)

You can create users in two ways:

### Option A: Sign Up Through the Application (Recommended)
1. Start your application: `npm run dev`
2. Click "Sign Up" on the login page
3. Enter your details and create an account
4. Check your email for verification link (if email confirmation is enabled)
5. Sign in with your new credentials

### Option B: Create User Manually in Supabase

1. Go to **Authentication** → **Users** in Supabase
2. Click **Add User** → **Create new user**
3. Enter:
   - Email: `admin@example.com`
   - Password: (choose a strong password)
   - Auto Confirm User: ✓ (checked) - This skips email verification
4. After creating the user, note the User ID (UUID)

5. Go to **SQL Editor** and run:
```sql
INSERT INTO public.users (id, email, name, created_at)
VALUES ('<paste-user-id-here>', 'admin@example.com', 'Admin', NOW());
```

Replace `<paste-user-id-here>` with the User ID from step 4.

**Note:** The application no longer uses hardcoded credentials. All users must be created through Supabase Auth.

## Step 7: Test the Integration

1. Make sure your `.env.local` file is configured correctly
2. Restart your development server:
   ```bash
   npm run dev
   ```
3. Try logging in with your admin credentials
4. Create a campaign, add leads, etc.
5. Check your Supabase dashboard → **Table Editor** to see the data being stored

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure `.env.local` exists and has the correct variable names
- Restart your dev server after creating/modifying `.env.local`
- Variable names must start with `VITE_` for Vite to expose them

### Error: "Failed to fetch" or Network errors
- Check that your `VITE_SUPABASE_URL` is correct
- Make sure your Supabase project is not paused (free tier projects pause after inactivity)

### Error: "Row Level Security policy violation"
- Make sure you've run the complete `supabase-schema.sql` file
- Check that RLS policies are created (go to **Authentication** → **Policies**)

### Data not appearing in Supabase
- Check the browser console for errors
- Verify you're authenticated (check **Authentication** → **Users** in Supabase)
- Make sure RLS policies allow the operation (check table policies)

## Database Schema Overview

The database includes these tables:

1. **users** - User profiles (linked to Supabase Auth)
2. **campaigns** - Email campaigns
3. **sequence_steps** - Email sequence steps for campaigns
4. **leads** - Lead contact information
5. **smtp_accounts** - SMTP configuration for sending emails
6. **email_messages** - Received emails (inbox)
7. **execution_logs** - Logs of email/webhook executions

All tables have Row Level Security enabled, ensuring users can only access their own data.

## Next Steps

- The application will automatically use Supabase once configured
- All data operations now go through the database instead of localStorage
- Data persists across sessions and browsers
- Multiple users can use the application with isolated data

## Need Help?

- Check the Supabase documentation: https://supabase.com/docs
- Review the service functions in `lib/supabase.ts`
- Check browser console and Supabase logs for errors
