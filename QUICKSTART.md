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

1. Open the folder in your text editor
2. Go to: `src` → `data` → `recipes.json`
3. You'll see 3 sample recipes
4. Copy one recipe block and add yours:

```json
{
  "id": 4,
  "title": "Your Recipe Name",
  "description": "Short description",
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "difficulty": "Easy",
  "image": "🍕",
  "ingredients": [
    "Ingredient 1",
    "Ingredient 2"
  ],
  "steps": [
    "Step 1",
    "Step 2"
  ]
}
```

4. Save the file
5. **Browser auto-refreshes** – your recipe appears! ✨

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
