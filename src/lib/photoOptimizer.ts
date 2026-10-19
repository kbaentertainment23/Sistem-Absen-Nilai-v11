import { convertGoogleDriveUrl, isGoogleDriveUrl } from '../utils/imageHelper';

/**
 * Standard photo URL resolver for student photos (supporting Google Drive URLs and base64)
 */
export function getStudentPhotoUrl(foto?: string): string | undefined {
  if (!foto || foto.trim() === '') return undefined;
  return convertGoogleDriveUrl(foto);
}

/**
 * Safe localStorage setter that swallows QuotaExceededError gracefully
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`localStorage setItem failed for key "${key}":`, err);
    return false;
  }
}

/**
 * Generic image optimizer to downscale & compress base64 images to lightweight data URLs
 */
export async function optimizeImage(
  input: File | string,
  maxSize: number = 350,
  quality: number = 0.7
): Promise<string> {
  return optimizeStudentPhoto(input, maxSize, quality);
}

/**
 * Student Photo Optimizer & Fallback Utilities
 * Optimizes student photos to compact 250x250 JPEG images with ~5-10KB file size,
 * drastically reducing Firestore storage usage while keeping crisp rendering.
 */

export async function optimizeStudentPhoto(
  input: File | string,
  maxSize: number = 250,
  quality: number = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    if (!input) {
      resolve('');
      return;
    }

    const isPng = (input instanceof File && input.type === 'image/png') ||
                  (typeof input === 'string' && (input.includes('image/png') || input.endsWith('.png')));

    const processImageSource = (srcUrl: string) => {
      let finalUrl = srcUrl;
      if (typeof finalUrl === 'string' && isGoogleDriveUrl(finalUrl)) {
        finalUrl = convertGoogleDriveUrl(finalUrl);
        // External Google Drive direct links do not need base64 re-compression
        resolve(finalUrl);
        return;
      }

      // Don't re-compress if it's already an external HTTP/HTTPS URL
      if (typeof finalUrl === 'string' && !finalUrl.startsWith('data:image')) {
        resolve(finalUrl);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (isPng || srcUrl.startsWith('data:image/png')) {
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/png');
              resolve(compressed);
            } else {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', quality);
              resolve(compressed);
            }
          } else {
            resolve(finalUrl);
          }
        } catch {
          resolve(finalUrl);
        }
      };

      img.onerror = () => {
        // Fallback gracefully on load error
        resolve(finalUrl);
      };

      img.src = finalUrl;
    };

    if (typeof input === 'string') {
      processImageSource(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          processImageSource(result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(input);
    }
  });
}

/**
 * Handle image element load error by hiding the broken img tag
 * and showing any sibling fallback element.
 */
export function handleStudentPhotoError(e: React.SyntheticEvent<HTMLImageElement, Event> | any, ..._args: any[]) {
  if (e?.currentTarget) {
    e.currentTarget.style.display = 'none';
    const parent = e.currentTarget.parentElement;
    if (parent) {
      const fallback = parent.querySelector('.photo-fallback');
      if (fallback) {
        (fallback as HTMLElement).style.display = 'flex';
      }
    }
  }
}
