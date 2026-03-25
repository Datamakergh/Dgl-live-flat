# 🚀 DGL Live Dashboard — Setup Guide
## Your Notion token and database IDs are already pre-configured.
## You only need to deploy to Vercel. This takes about 5 minutes.

---

## What's already done for you ✅
- ✅ Notion token pre-configured
- ✅ All 10 database IDs pre-configured:
  - 👥 Employee Directory
  - 📅 Attendance
  - 🏖️ Leave Requests
  - 📐 Projects
  - 📦 Asset Register
  - 🎫 IT Tickets
  - 🔧 Maintenance Schedule
  - 🔐 System Access Register
  - 🧾 Invoice (Unpaid)
  - 🧾 Invoice (Paid)

---

## STEP 1 — Upload files to GitHub

1. Go to **https://github.com** and sign in
2. Click **"+"** → **"New repository"**
3. Name it: `dgl-dashboard` → click **Create repository**
4. Click **"uploading an existing file"**
5. Upload all files keeping this folder structure:
   ```
   vercel.json
   api/
     notion.js
   public/
     index.html
   ```
6. Click **Commit changes**

---

## STEP 2 — Deploy on Vercel

1. Go to **https://vercel.com** and sign in
2. Click **"Add New Project"**
3. Click **"Import"** next to your `dgl-dashboard` repository
4. Leave all settings as default
5. Click **Deploy**
6. Wait ~30 seconds — Vercel will give you a URL like:
   `https://dgl-dashboard-abc123.vercel.app`

---

## STEP 3 — Open the Dashboard

1. Visit your Vercel URL in a browser
2. A small popup will appear asking for your **API URL**
3. Enter: `https://your-vercel-url.vercel.app/api/notion`
   (replace `your-vercel-url` with your actual Vercel URL)
4. Click **Save & Connect**
5. The dashboard will load all your live Notion data ✅

---

## How it works after setup

| Event | What happens |
|---|---|
| You open the dashboard | Fetches all Notion data immediately |
| Click "Sync Notion" button | Manual refresh |
| Every 5 minutes | Auto-refresh in background |
| You edit data in Notion | Shows on dashboard within 5 minutes |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Notion 401 error" | The token has expired — ask the workspace owner to regenerate it |
| "Notion 403 error" | A database wasn't shared with the integration — ask the owner to re-share it |
| "Notion 404 error" | Double-check the database IDs in api/notion.js |
| Data loads but columns show "—" | Column names in your Notion DB don't match expected names — see below |

## Expected Notion column names

The API tries many variations automatically, but if data shows as "—" for a field,
check your Notion database has a column matching one of these names:

### Employee Directory
Name · Role · Department · Contract Type · Start Date · Status · Leave Balance · Email · Phone

### Attendance
Employee · Date · Status · Department · Notes

### Leave Requests
Employee · Leave Type · From · To · Days · Status · Approved By · Notes

### Projects
Name · Client · Project Manager · Workers · Value · Progress · Deadline · Status · Site

### Asset Register
Name · Category · Asset Tag · Serial Number · Assigned To · Department · Value ·
Date Lent · Expected Return · Actual Return · Condition Out · Condition In · Status · Location

### IT Tickets
Name · Assigned To · Category · Date Raised · Priority · Status

### Maintenance
Name/Task · Location · Assigned To · Date · Status

### System Access Register
Name · Employee · Access Level · Granted By · Date Granted · Expiry Date · Status

### Invoices (Paid & Unpaid)
Invoice # · Client · Project · Amount · Issue Date · Due Date · Status · Notes

