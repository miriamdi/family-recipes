# 🚀 How to Deploy Your Recipe Website

Choose one of the two free options below. **Vercel is recommended** – it's the easiest and automatically updates whenever you change code.

---

## Option 1: Deploy to Vercel (⭐ Recommended – Easiest!)

**Why Vercel?** One-click deployment, automatic updates, free HTTPS, and no setup hassles.

### Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Create a new repository named `family-recipes` (can be public or private)
3. **Don't** initialize with README (we already have one)
4. Click "Create repository"

### Step 2: Push Your Code to GitHub

Run these commands in your terminal (inside the `recipes-site` folder):

```bash
git init
git add .
git commit -m "Initial recipe website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-recipes.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Deploy with Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up" and choose "Continue with GitHub"
3. Authorize Vercel to access your GitHub
4. Click "New Project"
5. Select your `family-recipes` repository
6. Click "Import"
7. Leave all settings as default
8. Click "Deploy"

**Done!** Your site is now live. Vercel shows you a URL like `family-recipes-abc123.vercel.app`.

### Step 4: Share the Link

Your site is now public! Share the URL with your family.

**To update recipes later:**
1. Edit `src/data/recipes.json` on your computer
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Added new recipe"
   git push
   ```
3. Vercel automatically redeploys – done! ✨

---

## Option 2: Deploy to GitHub Pages (Free Alternative)

**Why GitHub Pages?** Simpler setup, no extra account needed, hosted on GitHub for free.

### Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Create repository named `family-recipes`
3. Click "Create repository"

### Step 2: Update Vite Configuration

Edit `vite.config.js` and change it to:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/family-recipes/',
  plugins: [react()],
})
```

### Step 3: Update package.json

Change the build command. Edit `package.json` and update this line:

Find:
```json
"build": "vite build",
```

To:
```json
"build": "vite build",
```

(It should already be correct, no change needed)

### Step 4: Push Your Code

Run these commands:

```bash
git init
git add .
git commit -m "Initial recipe website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-recipes.git
git push -u origin main
```

### Step 5: Deploy with GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" (top right)
3. Click "Pages" (left sidebar)
4. Under "Source," select "GitHub Actions"
5. Select "Node.js" from the suggested workflows
6. Click "Configure"
7. Click "Commit changes..."
8. Scroll down and click "Commit changes"

Your site deploys automatically! It will be at `https://YOUR_USERNAME.github.io/family-recipes/`

---

## Updating Recipes After Deployment

### For Both Vercel and GitHub Pages:

**To add a new recipe:**

1. Open `src/data/recipes.json`
2. Add a new recipe object (copy an existing one as a template):

```json
{
  "id": 4,
  "title": "My New Recipe",
  "description": "Delicious family favorite",
  "prepTime": 20,
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

3. Save the file
4. Commit and push:
   ```bash
   git add src/data/recipes.json
   git commit -m "Added [recipe name]"
   git push
   ```

Your site updates automatically within 1-2 minutes! ✨

### To Edit an Existing Recipe:

1. Open `src/data/recipes.json`
2. Find the recipe you want to edit
3. Change the title, ingredients, steps, etc.
4. Save, commit, and push:
   ```bash
   git add src/data/recipes.json
   git commit -m "Updated [recipe name]"
   git push
   ```

---

## Customizing Your Website

### Change Colors

Edit `src/components/RecipeList.css` and `src/components/RecipeDetail.css`:

Look for color codes like `#e74c3c` (the red accent color) and change them to your preferred color.

Example colors:
- `#3498db` - Blue
- `#2ecc71` - Green
- `#f39c12` - Orange
- `#9b59b6` - Purple

### Change the Title

Edit `src/components/RecipeList.jsx`:

Find:
```jsx
<h1>Family Recipes</h1>
```

Change to:
```jsx
<h1>Smith Family Recipes</h1>
```

### Add More Info to Recipe Cards

Edit `src/components/RecipeList.jsx` to add more details or change the layout.

---

## Troubleshooting

### Site is blank or shows errors

1. Check the browser console (F12) for error messages
2. Make sure `src/data/recipes.json` is valid JSON (no trailing commas)
3. Check that all recipe IDs are unique numbers

### Changes aren't showing up

1. Wait 1-2 minutes for Vercel/GitHub to redeploy
2. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Check that you ran `git push` successfully

### Recipe images (emojis) not showing

Make sure you included the emoji in the `"image"` field. Emojis that work well:
🍪 🍝 🥞 🍕 🍰 🥗 🍔 🌮 🍜 🥘 🍲 🥙 🍛

---

## Questions?

**Need help?** Check these resources:
- [Vercel Docs](https://vercel.com/docs)
- [GitHub Pages Docs](https://pages.github.com/)
- [Vite Docs](https://vitejs.dev)

Happy cooking! 👨‍🍳👩‍🍳
