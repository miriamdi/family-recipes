/**
 * Client-side image utilities for compression and validation
 */

const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;
const TARGET_QUALITY = 0.8;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Compress image using canvas
 * @param {File} file - Image file to compress
 * @returns {Promise<Blob>} Compressed image blob
 */
export async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while preserving aspect ratio
        if (width > height) {
          if (width > MAX_IMAGE_WIDTH) {
            height = Math.round((height * MAX_IMAGE_WIDTH) / width);
            width = MAX_IMAGE_WIDTH;
          }
        } else {
          if (height > MAX_IMAGE_HEIGHT) {
            width = Math.round((width * MAX_IMAGE_HEIGHT) / height);
            height = MAX_IMAGE_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression failed'));
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          TARGET_QUALITY
        );
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image file
 * @param {File} file - Image file to validate
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateImageFile(file) {
  if (!file) return { valid: false, error: 'No file selected' };

  // Check file type
  if (!file.type || !file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image (JPG, PNG, WebP, etc.)' };
  }

  // Check file size before compression
  if (file.size > MAX_FILE_SIZE * 2) {
    return { valid: false, error: 'File is too large to process (max 4MB before compression)' };
  }

  return { valid: true, error: null };
}

/**
 * Process image for upload: validate, compress, and return blob with error handling
 * @param {File} file - Image file to process
 * @returns {Promise<{blob: Blob, error: string|null}>}
 */
export async function processImageForUpload(file) {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { blob: null, error: validation.error };
  }

  try {
    const compressed = await compressImage(file);

    // Check compressed size
    if (compressed.size > MAX_FILE_SIZE) {
      return {
        blob: null,
        error: `Compressed image still too large (${Math.round(compressed.size / 1024 / 1024 * 10) / 10}MB, max 2MB). Try a lower resolution image.`
      };
    }

    return { blob: compressed, error: null };
  } catch (err) {
    return {
      blob: null,
      error: `Image processing failed: ${err.message}`
    };
  }
}

/**
 * Get a random image from an array of images
 * @param {Array} images - Array of image URLs
 * @returns {string|null} Random image URL or null if no images
 */
export function getRandomImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images[Math.floor(Math.random() * images.length)];
}
