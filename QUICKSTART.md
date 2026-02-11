# ⚡ Quick Start (5 Minutes)

Get your recipe website running locally in 5 minutes!

## Step 1: Install Node.js

1. Go to [nodejs.org](https://nodejs.org)
2. Click the big green button (LTS version)
3. Install it (click Next → Next → Finish)
4. Restart your computer

## Step 2: Open Terminal in This Folder

**Windows:**
- Hold `Shift` and right-click the `recipes-site` folder
- Click "Open PowerShell here" (or "Open terminal here")

**Mac/Linux:**
- Right-click the folder → "New Terminal at Folder"

## Step 3: Run These Commands

Copy & paste each line, then press Enter:

```bash
npm install
```

Wait for it to finish (takes 30 seconds)...

```bash
npm run dev
```

## Step 4: Open in Browser

Click this link: **http://localhost:5173**

🎉 **Your recipe website is running!**

---

## ✏️ Add Your First Recipe

- To add a recipe in production, insert a row into the Supabase `public.recipes` table (Table Editor) or use the site's **מתכון חדש** form while authenticated with an approved email.
- Local development: open the running site and use **מתכון חדש** — entries are stored in `localStorage` (key: `userRecipes`) so you can iterate without a DB.

Tips:
- Use the Add Recipe form for quick testing (no build required).
- To pre-seed production, add rows directly in Supabase or run SQL from `SUPABASE_SETUP.md`.

---

## 🚀 Deploy to the Internet

Ready to share with your family?

📖 **See:** [DEPLOYMENT.md](DEPLOYMENT.md)

**TL;DR:** Push to GitHub, click Deploy on Vercel. Done.

---

## 🛑 Stop the Server

Press `Ctrl + C` in the terminal to stop.

To start again:
```bash
npm run dev
```

---

**That's it!** You're now a web developer. 🎉
