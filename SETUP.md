# 👨‍👩‍👧‍👦 Family Recipe Website

A simple, beautiful, mobile-friendly recipe website built with React + Vite. Perfect for sharing family recipes with everyone!

## ✨ Features

- 📱 **Mobile-Friendly**: Works perfect on phones, tablets, and computers
- 🎨 **Clean Design**: Simple, modern interface that's easy to use
- ⚡ **Fast**: Built with Vite for instant performance
- 📝 **Easy to Update**: Add/edit recipes by editing a simple JSON file
- 🚀 **Free to Deploy**: YouTube-style public link for anyone to access
- 🎯 **No Database**: All recipes stored in a simple JSON file

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
│   ├── data/
│   │   └── recipes.json         ← YOUR RECIPES HERE ⭐
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

**Key file: `src/data/recipes.json`** ← This is where your recipes live!

## 📝 Adding Recipes

Edit `src/data/recipes.json` and add recipes like this:

```json
{
  "id": 4,
  "title": "Grandma's Apple Pie",
  "description": "Warm, comfort food classic",
  "prepTime": 20,
  "cookTime": 45,
  "servings": 8,
  "difficulty": "Medium",
  "image": "🥧",
  "ingredients": [
    "2 pie crusts",
    "6 cups sliced apples",
    "1/2 cup sugar",
    "1 tsp cinnamon",
    "2 tbsp butter"
  ],
  "steps": [
    "Preheat oven to 375°F",
    "Place apples in pie crust",
    "Add sugar and cinnamon",
    "Top with second crust",
    "Bake for 45 minutes until golden"
  ]
}
```

**Important:**
- Each recipe needs a unique `id` (1, 2, 3, 4, etc.)
- Keep commas between recipes and items
- `image` should be an emoji (🍪 🍝 🥞 🍕, etc.)
- Use exactly the same structure for all recipes

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
2. Edit recipes in `src/data/recipes.json` and see updates instantly
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
- Check `src/data/recipes.json` for syntax errors (missing commas, quotes)
- Use [jsonlint.com](https://jsonlint.com) to validate JSON
- Make sure recipe `id` is unique

## 📚 File Descriptions

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main app – handles showing recipe list vs detail view |
| `src/components/RecipeList.jsx` | The homepage showing all recipes |
| `src/components/RecipeDetail.jsx` | Individual recipe page |
| `src/data/recipes.json` | **All your recipes stored here** |
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
