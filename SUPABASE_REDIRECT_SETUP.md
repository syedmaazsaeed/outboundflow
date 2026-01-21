# Supabase Redirect URL Configuration

## Password Reset Redirect Issue Fix

If password reset emails redirect to the sign-in page instead of the reset password page, you need to configure the redirect URL in Supabase.

### Step 1: Configure Redirect URL in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. In the **Redirect URLs** section, add:
   ```
   http://localhost:3000/reset-password
   http://localhost:3000
   ```
   For production, also add:
   ```
   https://yourdomain.com/reset-password
   https://yourdomain.com
   ```
4. Set **Site URL** to: `http://localhost:3000` (or your production URL)
5. Click **Save**

### Step 2: Update Email Template Redirect URL

The password reset email template uses `{{ .ConfirmationURL }}` which automatically includes the redirect URL. Make sure:

1. Go to **Authentication** → **Email Templates** → **Reset password**
2. The email template should have:
   ```html
   <h2>Reset Password</h2>
   <p>Follow this link to reset the password for your user:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
   ```
3. The `{{ .ConfirmationURL }}` will automatically use the redirect URL you configured

### Step 3: Verify the Setup

1. Request a password reset from your app
2. Check the email you receive
3. Click the reset link
4. It should redirect to: `http://localhost:3000/reset-password#access_token=...&type=recovery`
5. The app will automatically detect this and show the Reset Password page

### Troubleshooting

**Issue: Still redirecting to sign-in page**
- Make sure the redirect URL is exactly: `http://localhost:3000/reset-password` (no trailing slash)
- Check that the URL is added to the **Redirect URLs** list in Supabase
- Clear browser cache and try again

**Issue: Reset password page shows "Invalid link"**
- The link might have expired (links expire after 1 hour)
- Request a new password reset
- Make sure you're clicking the link within 1 hour of receiving it

**Issue: Hash fragment not working**
- Some browsers or extensions might strip hash fragments
- Try in an incognito/private window
- Make sure JavaScript is enabled

### How It Works

1. User clicks "Forgot Password" and enters email
2. Supabase sends email with reset link
3. Link format: `https://your-project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=http://localhost:3000/reset-password`
4. Supabase redirects to: `http://localhost:3000/reset-password#access_token=...&type=recovery`
5. App detects the hash fragment and shows ResetPassword component
6. User enters new password and submits
7. Password is updated and user is redirected to login
