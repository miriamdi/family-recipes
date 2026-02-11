# 👨‍👩‍👧‍👦 Family Recipe Website

A simple, beautiful, mobile-friendly recipe website built with React + Vite. Perfect for sharing family recipes with everyone!

## ✨ Features

- 📱 **Mobile-Friendly**: Works perfect on phones, tablets, and computers
- 🎨 **Clean Design**: Simple, modern interface that's easy to use
- ⚡ **Fast**: Built with Vite for instant performance
- 📝 **Easy to Update**: Add/edit recipes via the site UI or in Supabase (recommended)
- 🚀 **Free to Deploy**: YouTube-style public link for anyone to access
- 🎯 **Backend-ready**: Uses Supabase as the production data store; local dev falls back to `localStorage`

## 🚀 Quick Start

### Prerequisites

Make sure you have these installed:
- **Node.js** (download from [nodejs.org](https://nodejs.org/)) – includes npm
- **Git** (download from [git-scm.com](https://git-scm.com/))
- A text editor (VS Code, Notepad++, etc.)

### Setup (One-Time)

**1. Open Terminal/PowerShell**

On Windows:
- Right-click the `recipes-site` folder → "Open in Terminal" 
- OR: Win + X → A (to open PowerShell)

**2. Install dependencies (copy & paste):**

```bash
npm install
```

**3. Start the developer server:**

```bash
npm run dev
```

**4. Open in browser:**

Go to `http://localhost:5173` – your recipe site is live!

## 📁 Folder Structure Explained

```
recipes-site/
├── src/
│   ├── components/
│   │   ├── RecipeList.jsx       ← Shows all recipes
│   │   ├── RecipeList.css
│   │   ├── RecipeDetail.jsx     ← Shows one recipe
│   │   └── RecipeDetail.css
│   ├── data/                       ← (no bundled recipes; Supabase is the source of truth)
│   ├── App.jsx                  ← Main app logic
│   ├── App.css
│   ├── index.css                ← Global styles
│   └── main.jsx
├── public/                       ← Public files (images, etc.)
├── package.json                 ← Project settings
├── vite.config.js               ← Build configuration
├── index.html                   ← Main HTML page
├── DEPLOYMENT.md                ← How to publish your site
└── README.md                    ← This file
```

**Where recipes live**

- In production this project uses Supabase as the single source of truth: add and manage recipes in the `recipes` table (Table Editor) or via the site's Add Recipe UI (approved users only).
- For local development the app keeps user-submitted recipes in `localStorage` (key: `userRecipes`) so you can iterate without a DB.

## 📝 Adding Recipes (recommended)

1) In production: add recipes in your Supabase project
   - Open Supabase → Table Editor → `public.recipes`
   - Click **Insert row** and fill the fields (or use the site's **מתכון חדש** form)

2) For local development (no Supabase): use the Add Recipe form on the running site — it stores entries in `localStorage` so you can iterate quickly.

If you need to seed the DB programmatically, use the SQL snippets in `SUPABASE_SETUP.md` or insert rows from the Supabase UI.

## 🎨 Customizing Colors & Look

### Change the Main Color (Red → Your Color)

1. Open `src/components/RecipeList.css`
2. Find `#e74c3c` (appears several times)
3. Change to your preferred color:
   - `#3498db` = Blue
   - `#2ecc71` = Green
   - `#f39c12` = Orange
   - `#9b59b6` = Purple

### Change the Website Title

Edit `src/components/RecipeList.jsx`:

```jsx
<h1>Your Family Name Recipes</h1>
```

### Change Font

Edit `src/index.css` and look for `font-family`. Change the font names to pick a different style.

## 🧪 Testing Locally

**While `npm run dev` is running:**
1. Browser automatically refreshes when you save changes
2. Add recipes using the site's **מתכון חדש** form (local dev stores entries in `localStorage`) or connect the app to a Supabase dev instance to test against the real DB
3. Test on your phone: connect to `http://[YOUR_IP]:5173`
   - Find YOUR_IP by running: `ipconfig` (Windows) or `ifconfig` (Mac/Linux), look for IPv4 address

## 📦 Building for Production

Before deploying (or if you want to test the built version):

```bash
npm run build
```

This creates an optimized `dist/` folder with your website ready for the internet.

## 🚀 Deploying Your Site

📖 **Full deployment guide:** See [DEPLOYMENT.md](DEPLOYMENT.md)

### Quick Summary:

**Vercel (Recommended ⭐ – Fastest):**
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com), click "Import"
3. Select your repository
4. Done! Site is live with automatic updates

**GitHub Pages (Simpler setup):**
1. Push code to GitHub
2. Enable "GitHub Pages" in Settings
3. Done! Site lives at `https://YOUR_USERNAME.github.io/family-recipes/`

## 🔧 Troubleshooting

### "npm: command not found"
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart your terminal
- Try again

### Port 5173 already in use
```bash
npm run dev -- --port 3000
```
Then go to `http://localhost:3000`

### Changes not showing
- Make sure you saved the file (Ctrl+S)
- Check the terminal for error messages
- Hard refresh browser (Ctrl+Shift+R)

### Recipe not showing
- If using a local JSON/data export to seed a dev DB, validate it before inserting; otherwise use the Supabase Table Editor to add rows.
- Use [jsonlint.com](https://jsonlint.com) to validate JSON
- Make sure recipe `id` is unique

## 📚 File Descriptions

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main app – handles showing recipe list vs detail view |
| `src/components/RecipeList.jsx` | The homepage showing all recipes |
| `src/components/RecipeDetail.jsx` | Individual recipe page |
| `public/` or Supabase `recipes` table | **Production recipes: Supabase (preferred). Local test recipes: browser `localStorage`** |
| `src/index.css` | Global styles (fonts, colors, etc.) |
| `vite.config.js` | Vite build settings |
| `package.json` | Project configuration and dependencies |

## 💡 Tips & Tricks

- **Backup your recipes**: Keep a copy of `recipes.json`
- **Use emojis**: Makes recipes look fun and easy to identify
- **Mobile first**: Test on your phone to see how it looks
- **Ask for feedback**: Get family members to test it
- **Keep it simple**: Don't overcomplicate recipes – simpler is better for family sharing

## 🆘 Need Help?

- **GitHub Issues**: Search GitHub for similar issues
- **Vite Docs**: [vitejs.dev](https://vitejs.dev)
- **React Docs**: [react.dev](https://react.dev)
- **Deployment Help**: See [DEPLOYMENT.md](DEPLOYMENT.md)

## 📄 License

This project is open source and free to use and modify for personal or family use.

---

**Happy cooking! 👨‍🍳👩‍🍳**

Made with ❤️ for families who love sharing recipes.
