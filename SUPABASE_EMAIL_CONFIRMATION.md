# Email Confirmation Setup Guide

## Issue: Can't Sign In After Sign Up

If you've signed up but can't sign in, it's likely because **email confirmation is required** in your Supabase settings.

## Quick Fix: Disable Email Confirmation (For Development)

This is the easiest solution for development/testing:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find the **"Confirm email"** toggle
4. **Turn it OFF** (disable email confirmation)
5. Save the changes

Now users can sign in immediately after signing up without needing to confirm their email.

## Proper Setup: Enable Email Confirmation (For Production)

If you want to keep email confirmation enabled (recommended for production), you need to configure the confirmation redirect URL:

### Step 1: Configure Redirect URL in Supabase

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:3000` (for development)
3. Add to **Redirect URLs**:
   - `http://localhost:3000`
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`

### Step 2: Handle Email Confirmation in Your App

When users click the confirmation link in their email, Supabase will redirect them to your app with a token. You need to handle this redirect.

**Option A: Simple Redirect (Recommended)**

Update your `App.tsx` to check for email confirmation tokens on load:

```typescript
// Add this useEffect in App.tsx
useEffect(() => {
  const handleEmailConfirmation = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return;

    // Check for email confirmation token in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (accessToken && type === 'signup') {
      // User confirmed their email
      // The session is automatically set by Supabase
      // Just reload to get the authenticated state
      window.location.hash = '';
      window.location.reload();
    }
  };

  handleEmailConfirmation();
}, []);
```

**Option B: Create a Callback Page**

Create a new file `components/AuthCallback.tsx`:

```typescript
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthCallback = () => {
  useEffect(() => {
    const handleCallback = async () => {
      // Supabase automatically handles the callback
      // Just redirect to home
      window.location.href = '/';
    };
    handleCallback();
  }, []);

  return <div>Confirming your email...</div>;
};
```

## Verify Email Confirmation Status

To check if a user's email is confirmed:

1. Go to **Authentication** → **Users** in Supabase
2. Find your user
3. Check the **"Email Confirmed"** column
4. If it shows "No", the user hasn't clicked the confirmation link yet

## Manual Confirmation (For Testing)

You can manually confirm a user's email in Supabase:

1. Go to **Authentication** → **Users**
2. Click on the user
3. Click **"Send confirmation email"** or manually set **"Email Confirmed"** to true

## Troubleshooting

### Email Not Received?

1. Check **Spam/Junk** folder
2. Verify email is correct in Supabase dashboard
3. Check Supabase email logs: **Authentication** → **Logs**
4. For development, Supabase free tier limits to 3 emails/hour

### Confirmation Link Expired?

- Confirmation links expire after 24 hours
- Request a new confirmation email from the login page (add this feature) or from Supabase dashboard

### Still Can't Sign In?

1. Check browser console for errors
2. Verify Supabase credentials in `.env.local`
3. Check Supabase dashboard → **Authentication** → **Logs** for error messages
4. Ensure RLS policies allow user access (check `supabase-schema.sql`)

## Recommended Setup for Development

For easier development, disable email confirmation:

1. **Authentication** → **Providers** → **Email**
2. Turn OFF **"Confirm email"**
3. Users can sign in immediately after sign up

For production, enable email confirmation and configure proper redirect URLs.
