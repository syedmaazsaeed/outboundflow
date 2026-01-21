# 🚀 Vercel Deployment Guide for OutboundFlow

This guide will walk you through deploying your OutboundFlow application to Vercel step by step.

## 📋 Prerequisites

Before you begin, make sure you have:
- ✅ A GitHub account
- ✅ Your code pushed to a GitHub repository
- ✅ A Vercel account (free tier works perfectly)
- ✅ Your Supabase project set up (if using Supabase)
- ✅ Your environment variables ready

---

## 🎯 Step-by-Step Deployment Instructions

### **Step 1: Prepare Your GitHub Repository**

1. **Make sure your code is committed and pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```
   *(Replace `main` with your branch name if different)*

2. **Verify your repository is public or you have access to connect it to Vercel**

---

### **Step 2: Sign Up / Log In to Vercel**

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Sign Up"** (or **"Log In"** if you already have an account)
3. Choose **"Continue with GitHub"** to connect your GitHub account
4. Authorize Vercel to access your GitHub repositories

---

### **Step 3: Import Your Project**

1. Once logged in, click **"Add New..."** → **"Project"**
2. You'll see a list of your GitHub repositories
3. Find and click on your **OutboundFlow repository**
4. Click **"Import"**

---

### **Step 4: Configure Project Settings**

Vercel will automatically detect your project settings, but verify:

1. **Framework Preset:** Should be **"Vite"** (auto-detected)
2. **Root Directory:** Leave as **"./"** (root of repository)
3. **Build Command:** Should be `npm run build` (auto-filled)
4. **Output Directory:** Should be `dist` (auto-filled)
5. **Install Command:** Should be `npm install` (auto-filled)

**✅ These should all be correct automatically!**

---

### **Step 5: Configure Environment Variables**

This is **CRITICAL** for your app to work properly!

1. In the project configuration page, scroll down to **"Environment Variables"**
2. Click **"Add"** and add each of these variables:

   #### **Required Variables:**
   
   **For Supabase (if using Supabase):**
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - **Environment:** Select all (Production, Preview, Development)
   
   - **Name:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Your Supabase anon public key
   - **Environment:** Select all (Production, Preview, Development)

   **For Gemini AI (optional but recommended):**
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Your Google Gemini API key
   - **Environment:** Select all (Production, Preview, Development)

3. **Important Notes:**
   - Make sure variable names start with `VITE_` for Vite to expose them
   - Don't add quotes around the values
   - Select all environments (Production, Preview, Development) for each variable

---

### **Step 6: Deploy!**

1. Review all settings one more time
2. Click **"Deploy"** button
3. Wait for the build to complete (usually 1-3 minutes)
4. You'll see a success message with your deployment URL!

---

### **Step 7: Access Your Deployed Website**

1. After deployment, you'll see:
   - **Production URL:** `https://your-project-name.vercel.app`
   - This is your live website! 🎉

2. **Custom Domain (Optional):**
   - Click on your project in Vercel dashboard
   - Go to **"Settings"** → **"Domains"**
   - Add your custom domain if you have one

---

## 🌐 Project Name Suggestion

**Recommended Project Name:** `outboundflow`

This will give you the URL: `https://outboundflow.vercel.app`

**Alternative names:**
- `outboundflow-app`
- `outboundflow-campaigns`
- `email-campaign-manager`

**Note:** You can change the project name in Vercel:
1. Go to your project settings
2. Click on the project name at the top
3. Edit and save

---

## 🔄 Automatic Deployments

Vercel automatically deploys:
- ✅ **Production:** Every push to your `main` (or `master`) branch
- ✅ **Preview:** Every push to other branches or pull requests

You don't need to do anything - it's automatic! 🚀

---

## 🔧 Troubleshooting

### **Issue: Build Fails**

**Solution:**
1. Check the build logs in Vercel dashboard
2. Make sure all dependencies are in `package.json`
3. Verify your `vercel.json` file is correct
4. Check that environment variables are set correctly

### **Issue: Blank Page After Deployment**

**Solution:**
1. Check browser console (F12) for errors
2. Verify environment variables are set in Vercel:
   - Go to **Settings** → **Environment Variables**
   - Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Check that your Supabase project is not paused
4. Verify the `vercel.json` rewrite rules are correct

### **Issue: 404 Errors on Routes**

**Solution:**
- The `vercel.json` file should handle this with the rewrite rule
- Make sure `vercel.json` is in your repository root
- Redeploy if you just added `vercel.json`

### **Issue: Environment Variables Not Working**

**Solution:**
1. Make sure variable names start with `VITE_` (for Vite projects)
2. Redeploy after adding environment variables
3. Check that variables are set for the correct environment (Production/Preview/Development)

### **Issue: Supabase Connection Errors**

**Solution:**
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
2. Check Supabase dashboard to ensure project is active
3. Verify Supabase redirect URLs include your Vercel domain:
   - Go to Supabase Dashboard → **Authentication** → **URL Configuration**
   - Add: `https://your-project.vercel.app`
   - Add: `https://your-project.vercel.app/**` (for all routes)

---

## 📝 Post-Deployment Checklist

After deployment, verify:

- [ ] Website loads without errors
- [ ] Login/signup works (if using Supabase)
- [ ] Environment variables are accessible
- [ ] All routes work (no 404 errors)
- [ ] Supabase connection works (if using Supabase)
- [ ] API calls succeed (check browser console)

---

## 🔐 Security Notes

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Environment variables in Vercel are encrypted** - Safe to store there
3. **Supabase keys are safe** - The anon key is meant to be public
4. **Gemini API key** - Keep it secret, only add to Vercel environment variables

---

## 🎉 You're Done!

Your OutboundFlow application is now live on Vercel! 

**Your website URL:** `https://your-project-name.vercel.app`

Every time you push to GitHub, Vercel will automatically redeploy your site with the latest changes.

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)
- [Supabase Documentation](https://supabase.com/docs)

---

**Need Help?** Check the Vercel dashboard logs or the troubleshooting section above.

**Happy Deploying! 🚀**
