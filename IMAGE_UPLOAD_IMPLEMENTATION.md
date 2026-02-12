# Full Image Upload Support Implementation

## Overview
This document describes the implementation of complete image upload functionality for recipes, with support for up to 20 images per recipe, user attribution, and full permission enforcement.

## Database Schema

### New Table: `recipe_images`
Stores metadata for all recipe images with uploader attribution:

```sql
create table if not exists public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  image_url text not null,
  uploaded_by_user_id uuid not null,
  uploaded_by_user_name text,
  created_at timestamptz default now(),
  foreign key (recipe_id) references public.recipes(id) on delete cascade,
  foreign key (uploaded_by_user_id) references auth.users(id) on delete restrict
);
```

**Columns:**
- `id`: Unique identifier for the image record
- `recipe_id`: FK to recipes table
- `image_url`: Public URL of the image in Supabase storage
- `uploaded_by_user_id`: User ID who uploaded (from auth.users)
- `uploaded_by_user_name`: Display name of uploader (cached for performance)
- `created_at`: Timestamp of upload

### Row Level Security (RLS) Policies

1. **Read Public**: Anyone can view all recipe images
   ```sql
   create policy "recipe_images_read_public" on public.recipe_images
     for select to public using (true);
   ```

2. **Insert (Approved Users Only)**: Only authenticated approved users can insert images
   ```sql
   create policy "recipe_images_insert_approved" on public.recipe_images
     for insert to authenticated
     with check (
       auth.uid() = uploaded_by_user_id
       and auth.email() in (select email from public.approved_emails)
     );
   ```

3. **Delete (Own or Admin)**: Users can delete only their own images; admin (`miriam995@gmail.com`) can delete any
   ```sql
   create policy "recipe_images_delete_own_or_admin" on public.recipe_images
     for delete to authenticated
     using (
       auth.uid() = uploaded_by_user_id
       or auth.email() = 'miriam995@gmail.com'
     );
   ```

## Frontend Components

### 1. ImageUploader.jsx (New Component)
Handles image upload for a specific recipe.

**Props:**
- `recipeId` (uuid): Recipe to upload to
- `currentImageCount` (number): Current image count
- `maxImages` (number): Maximum allowed (20)
- `onImageAdded` (function): Callback when upload succeeds
- `user` (object): Current user (with id, email)
- `displayName` (string): User's display name
- `disabled` (boolean): Disable if max reached

**Features:**
- Client-side image compression (1200x1200 max, preserves aspect ratio)
- Clear error messages for common failures:
  - Permission denied (not approved)
  - Max images reached
  - File too large
  - Unsupported format
  - Network errors
- Uploads to Supabase Storage then creates DB record
- Shows upload progress
- Integrated error handling

### 2. ImageGallery.jsx (New Component)
Displays all images for a recipe in a grid layout.

**Props:**
- `images` (array): Recipe images from recipe_images table
- `recipeId` (uuid): Recipe ID (for context)
- `user` (object): Current user
- `onImageDeleted` (function): Callback when image deleted

**Features:**
- Grid layout (auto-fill, 150px min width)
- Shows uploader name on each image
- Delete button only visible to:
  - Image uploader (owner)
  - Admin user
- Click to view full size in new tab
- Integrated error handling for deletions

### 3. Updated AddRecipe.jsx
- Now accepts `displayName` prop
- Initial image upload during recipe creation:
  - Uploads to storage
  - Creates record in `recipe_images` table
  - Uses display name if available
- Removed legacy `images` field from recipe payload

### 4. Updated RecipeDetail.jsx
- Fetches all images from `recipe_images` table on load
- Displays main recipe image from images[0] or fallback to emoji
- New section: "הכנת את המתכון? כאן אפשר להשוויץ עם תמונה"
  - Only visible to recipe owner or admin
  - Uses ImageUploader component
  - Shows current image count / max (20)
- Full gallery at bottom using ImageGallery component
- Removed old image handling code

### 5. Updated RecipeList.jsx
- Fetches all recipe images on page load
- Uses **stable random image selection** based on recipe ID hash
  - Same image shown consistently per page load
  - No flickering as page renders
- Shows uploader name on preview image
- Supports fallback to legacy emoji field

## Key Features Implemented

### 1. Image Compression (Client-Side)
Uses canvas API to resize and compress before upload:
- Max dimensions: 1200x1200px
- Preserves aspect ratio
- JPEG quality: 0.8
- Max file size: 2MB
- Compression happens in `src/lib/imageUtils.js`

### 2. Permission Enforcement
**UI Level:**
- Non-owners cannot see upload button
- Only image owner/admin see delete button
- Clear permission error messages

**Backend Level:**
- RLS policies enforce at database level
- Insert policy checks approved_emails
- Delete policy checks user ID or admin email
- Public read access for all images

### 3. Max Images: 20 per Recipe
- Enforced UI-side (button disabled)
- Clear message shown when limit reached
- Backend could add constraint if needed

### 4. User Attribution
- Each image records:
  - `uploaded_by_user_id` (from auth.uid())
  - `uploaded_by_user_name` (cached display name)
- User name shown on:
  - Recipe list preview images
  - Gallery images below recipe detail
  - Uploader label format: just the name

### 5. Error Handling
Clear, user-friendly messages for:
- "File must be an image (JPG, PNG, WebP, etc.)"
- "File is too large to process (max 4MB before compression)"
- "Compressed image still too large (X.XMB, max 2MB)"
- "Image processing failed: [reason]"
- Permission errors
- Network errors
- Missing bucket/storage issues
- User not authenticated
- Max images reached
- File read errors

### 6. Stable Preview Images
RecipeList uses hash-based stable random selection:
```javascript
const hash = recipeId.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
const index = Math.abs(hash) % images.length;
```
- Ensures same image per recipe per page load
- Prevents UX flickering
- No additional API calls needed

## Data Flow

### Upload Flow (New Recipe)
1. User creates recipe in AddRecipe
2. Optionally selects initial image
3. Recipe inserted to `recipes` table
4. If image provided:
   - Validated and compressed
   - Uploaded to `recipes-images` bucket
   - Record inserted to `recipe_images` with metadata
5. RecipeList refetches to show new recipe

### Upload Flow (Existing Recipe)
1. User visits RecipeDetail
2. Click "הכנת את המתכון? כאן אפשר להשוויץ עם תמונה"
3. ImageUploader component:
   - Validates file (type, size)
   - Compresses using processImageForUpload()
   - Uploads to storage
   - Inserts record to recipe_images table
   - Shows success message
4. Parent component refetches recipe_images to update gallery

### Delete Flow
1. User sees image in gallery
2. Click × button (only visible if owner/admin)
3. ImageGallery component:
   - Confirms action
   - Deletes DB record from recipe_images
   - Best-effort deletion from storage
   - Updates UI optimistically
4. Gallery re-renders

### Display Flow (RecipeList)
1. Load all recipes and all recipe_images
2. Group images by recipe_id
3. For each recipe, select one preview image:
   - Hash-based stable random from that recipe's images
   - Fallback to legacy emoji field
   - Fallback to no image
4. Show uploader name on preview

### Display Flow (RecipeDetail)
1. Load recipe and all its images
2. Main image: images[0] or legacy emoji
3. Gallery section: show all images with uploader names
4. Upload section: only if owner/admin and <20 images

## Setup Instructions

1. **Run SQL Migration**
   - Copy the SQL from [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
   - Run in Supabase SQL editor (specifically the `recipe_images` table and RLS policies sections)

2. **Verify Storage Bucket**
   - Ensure `recipes-images` bucket exists in Supabase Storage
   - Bucket should be public (or properly configured)

3. **Update Environment Variables**
   - Ensure `.env.local` has:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

4. **Install Dependencies** (already in package.json)
   - `@supabase/supabase-js` v2.37.0+

5. **Test**
   - Create new recipe with initial image
   - Visit recipe detail and upload more images
   - Verify only uploader/admin can delete
   - Check display names appear correctly
   - Test max 20 image limit

## Files Changed

### New Files
- `src/components/ImageUploader.jsx`
- `src/components/ImageGallery.jsx`
- `IMAGE_UPLOAD_IMPLEMENTATION.md` (this file)

### Updated Files
- `SUPABASE_SETUP.md` (added recipe_images table and RLS policies)
- `src/components/AddRecipe.jsx` (updated to use new table)
- `src/components/RecipeDetail.jsx` (major refactor to use recipe_images)
- `src/components/RecipeList.jsx` (updated preview image handling)

### Unchanged
- `src/lib/imageUtils.js` (already had compression logic)
- `src/lib/supabaseClient.js`
- `src/App.jsx`
- CSS files (may need minor tweaks if desired)

## Migration Notes

### Legacy Images
- Old `recipe.images` field (array in recipes table) is deprecated
- New system uses `recipe_images` table
- Recipes with images stored in old format will still show emoji/legacy image
- Can migrate old images later if needed

### Backward Compatibility
- System supports both old and new image storage
- Fallback chain: recipe_images > legacy recipe.images > recipe.image (emoji)

## Future Enhancements

1. **Image Cropping**: Let users crop before upload
2. **Image Reordering**: Drag-and-drop gallery reorganization
3. **Image Filtering**: Search recipes by image uploader
4. **Bulk Delete**: Select multiple images to delete
5. **Migration Script**: Move old images to recipe_images table
6. **Image Captions**: Store optional caption per image
7. **Thumbnail Generation**: Create optimized thumbnails
8. **Analytics**: Track which images are viewed most

## Troubleshooting

### Images not appearing
- Check RLS policies in Supabase Dashboard
- Verify bucket name is `recipes-images`
- Check browser console for fetch errors
- Ensure images stored with correct recipe_id

### Upload fails with "permission denied"
- User's email not in `approved_emails` table
- Check RLS policy for insert
- Verify user is authenticated

### Upload fails with "bucket not found"
- Create public bucket named `recipes-images` in Supabase Storage
- Or adjust bucket name in ImageUploader.jsx

### Images show uploader name as email instead of display name
- User's profile not created yet
- Call `getOrCreateProfile()` on first login
- Check profiles table has correct association

## Admin Credentials
**Admin email**: `miriam995@gmail.com` (hardcoded in RLS policies and components)
- Update this if admin email changes
- Locations: RecipeDetail.jsx, ImageUploader.jsx, ImageGallery.jsx, SUPABASE_SETUP.md

