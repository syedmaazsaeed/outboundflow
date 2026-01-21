# OutboundFlow - Email Campaign Management System

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

A modern, web-based email campaign management tool for creating, managing, and automating email sequences with lead tracking, SMTP integration, and webhook support.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Testing Guide](#testing-guide)
- [Features](#features)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Google Gemini API Key** (optional, for AI features) - [Get one here](https://makersuite.google.com/app/apikey)

---

## Installation

### Step 1: Navigate to Project Directory

```bash
cd htmv2-main
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React 19.2.3
- Vite 6.2.0
- TypeScript
- Lucide React (icons)
- Recharts (charts)
- @google/genai (Gemini AI)

---

## Configuration

### Step 1: Create Environment File

Create a file named `.env.local` in the `htmv2-main` directory:

**Windows (PowerShell):**
```powershell
cd "C:\Users\Laptop Land\Downloads\htmv2-main\htmv2-main"
echo "GEMINI_API_KEY=your_api_key_here" | Out-File -FilePath .env.local -Encoding utf8 -NoNewline
```

**Mac/Linux:**
```bash
cd htmv2-main
echo "GEMINI_API_KEY=your_api_key_here" > .env.local
```

### Step 2: Add Your Gemini API Key

Open `.env.local` and replace `your_api_key_here` with your actual Gemini API key:

```
GEMINI_API_KEY=AIzaSyATAEP6jUtGQevGu1GJzjwQeFNzyEYVWSM
```

**Important:** 
- Do NOT include quotes or semicolons
- Do NOT commit this file to version control (it's in .gitignore)
- The API key is optional - the app will work without it for basic features

---

## Running the Application

### Frontend (Main Application)

1. **Start the development server:**

```bash
npm run dev
```

2. **Access the application:**

Open your browser and navigate to:
```
http://localhost:3000
```

The app will automatically reload when you make changes to the code.

### Backend Server (Optional - for Real Email Sending)

The frontend works standalone, but for actual email sending, you need the backend server:

1. **Install backend dependencies:**

```bash
npm install express nodemailer cors
```

2. **Start the backend server:**

```bash
node server.js
```

The backend will run on `http://localhost:3001`

**Note:** The frontend can work in simulation mode without the backend. The backend is only needed for real SMTP email delivery.

---

## Testing Guide

### Complete Step-by-Step Testing Workflow

#### **Test 1: Verify Application Loads**

1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000` in your browser
3. ✅ **Expected:** You should see the OutboundFlow dashboard with navigation sidebar

#### **Test 2: Configure SMTP Account**

1. Click **"Settings"** in the left sidebar
2. Click **"+ Add SMTP"** button
3. Fill in the form:
   - **Account Label:** `Test Gmail Account`
   - **SMTP Host:** `smtp.gmail.com`
   - **SMTP User/Email:** `your-email@gmail.com`
   - **App Password:** `your-app-password` (not your regular password)
   - **From Email Address:** `your-email@gmail.com`
4. Click **"Save Account"**
5. ✅ **Expected:** New SMTP account appears in the list
6. Click **"Test Link"** button
7. ✅ **Expected:** Success message appears (simulated)

**Note:** For Gmail, you need to:
- Enable 2-factor authentication
- Generate an "App Password" from your Google Account settings
- Use the app password, not your regular password

#### **Test 3: Create a Campaign**

1. Click **"Campaigns"** in the sidebar
2. Click **"Create Campaign"** button
3. ✅ **Expected:** Campaign editor opens with a new campaign
4. In the campaign editor:
   - Change the campaign name to: `My First Campaign`
   - The campaign should have default settings
5. Click the **back arrow (←)** to return to campaign list
6. ✅ **Expected:** Your new campaign appears in the list

#### **Test 4: Import Leads via CSV**

1. **Create a test CSV file** named `test_leads.csv`:

```csv
email,firstName,lastName,company,website
john.doe@example.com,John,Doe,Acme Corporation,https://acme.com
jane.smith@example.com,Jane,Smith,Tech Solutions Inc,https://techsolutions.com
bob.johnson@example.com,Bob,Johnson,Startup Co,https://startupco.com
sarah.williams@example.com,Sarah,Williams,Digital Agency,https://digitalagency.com
```

2. Click **"Leads"** in the sidebar
3. Select your campaign from the dropdown (if you have multiple)
4. Click **"Import CSV"** button
5. Select your `test_leads.csv` file
6. ✅ **Expected:** 4 leads appear in the table
7. Click **"Verify List"** button
8. ✅ **Expected:** Verification status changes (simulated - may show VERIFIED or INVALID)

#### **Test 5: Verify Dashboard Updates**

1. Click **"Dashboard"** in the sidebar
2. ✅ **Expected:** 
   - Total Contacts shows: **4**
   - Other metrics may show 0 (since no emails sent yet)
   - Campaign health section shows your campaign

#### **Test 6: Configure Campaign Sequence**

1. Click **"Campaigns"** → Click on your campaign
2. In the campaign editor, you'll see tabs:
   - **Sequence:** Configure webhook steps
   - **Schedule:** Set sending schedule
   - **Logs:** View execution logs
3. **Test Sequence Tab:**
   - You can add/edit webhook URLs
   - Set delay days between steps
   - Add prompt hints for AI generation
4. **Test Schedule Tab:**
   - Select days of the week
   - Set start time (e.g., 09:00)
   - Set end time (e.g., 17:00)
   - Select timezone
5. ✅ **Expected:** Settings save when you navigate away

#### **Test 7: Test Campaign Execution (Simulated)**

1. In the campaign editor, ensure:
   - Campaign has leads
   - Sender account is selected (if available)
2. Click **"Start Campaign"** button
3. ✅ **Expected:** 
   - Execution logs appear in the Logs tab
   - Progress indicator shows
   - Status updates (simulated - no real emails sent)

#### **Test 8: Test Inbox**

1. Click **"Inbox"** in the sidebar
2. ✅ **Expected:** Empty inbox with "No replies detected yet"
3. Click **"Sync Inbox"** button
4. ✅ **Expected:** Loading animation, then returns to empty state (simulated)

#### **Test 9: Data Persistence**

1. Add a campaign and some leads
2. Refresh the browser (F5)
3. ✅ **Expected:** All data persists (stored in browser localStorage)

#### **Test 10: Navigation**

1. Click through all navigation items:
   - Dashboard
   - Campaigns
   - Leads
   - Inbox
   - Settings
2. ✅ **Expected:** Each section loads correctly
3. ✅ **Expected:** Active tab is highlighted in blue

---

## Features

### ✅ Core Features

- **Dashboard:** Real-time metrics and campaign performance
- **Campaign Management:** Create, edit, and manage email campaigns
- **Lead Management:** Import leads via CSV, verify email addresses
- **SMTP Integration:** Connect multiple SMTP accounts
- **Webhook Support:** Integrate with n8n or other automation tools
- **Scheduling:** Configure sending schedules and timezones
- **Inbox:** View and manage prospect replies
- **Execution Logs:** Track campaign execution in real-time

### 🎨 UI Features

- Modern, clean interface
- Responsive design
- Real-time updates
- Dark/light theme support
- Interactive charts and metrics

---

## Project Structure

```
htmv2-main/
├── components/          # React components
│   ├── Dashboard.tsx
│   ├── CampaignList.tsx
│   ├── CampaignEditor.tsx
│   ├── LeadManager.tsx
│   ├── Inbox.tsx
│   └── SettingsView.tsx
├── App.tsx             # Main application component
├── index.tsx           # Application entry point
├── index.html          # HTML template
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
├── package.json        # Dependencies and scripts
├── server.js           # Backend server (optional)
└── .env.local          # Environment variables (create this)
```

---

## Troubleshooting

### Issue: Blank Page / App Not Loading

**Solution:**
1. Check browser console (F12) for errors
2. Verify `.env.local` file exists and has correct format (no quotes, no semicolons)
3. Restart dev server: Stop (Ctrl+C) and run `npm run dev` again
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: "Cannot find module" Errors

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Windows:**
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### Issue: Port 3000 Already in Use

**Solution:**
1. Find and kill the process using port 3000:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Mac/Linux
   lsof -ti:3000 | xargs kill
   ```
2. Or change the port in `vite.config.ts`

### Issue: SMTP Connection Fails

**Solution:**
1. Verify SMTP credentials are correct
2. For Gmail: Use App Password, not regular password
3. Check firewall/antivirus isn't blocking connections
4. Verify SMTP host and port are correct:
   - Gmail: `smtp.gmail.com:587`
   - Outlook: `smtp-mail.outlook.com:587`
   - Custom: Check with your email provider

### Issue: CSV Import Not Working

**Solution:**
1. Ensure CSV has headers: `email`, `firstName`, `lastName`, `company`
2. Check CSV file encoding (should be UTF-8)
3. Verify CSV has at least 2 rows (header + data)
4. Ensure email addresses contain `@` symbol

### Issue: Data Not Persisting

**Solution:**
1. Check browser localStorage is enabled
2. Don't use incognito/private mode
3. Ensure cookies/localStorage aren't blocked

### Issue: Environment Variables Not Loading

**Solution:**
1. Verify file is named exactly `.env.local` (not `.env`)
2. File must be in the `htmv2-main` directory (same level as `package.json`)
3. Restart dev server after creating/modifying `.env.local`
4. Format: `GEMINI_API_KEY=your_key_here` (no spaces around `=`)

---

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start backend server (optional)
node server.js
```

---

## Additional Notes

- **Data Storage:** All data is stored in browser localStorage. Clearing browser data will remove all campaigns and leads.
- **Email Sending:** By default, email sending is simulated. For real emails, set up the backend server.
- **API Key:** The Gemini API key is optional. The app works without it for basic features.
- **Browser Support:** Modern browsers (Chrome, Firefox, Edge, Safari)

---

## Support

If you encounter issues:

1. Check the browser console (F12) for error messages
2. Verify all prerequisites are installed
3. Review the Troubleshooting section above
4. Ensure you're using the latest version of Node.js

---

## License

This project is provided as-is for educational and development purposes.

---

**Happy Testing! 🚀**
