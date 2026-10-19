/**
 * Image & Google Drive URL Conversion Utilities
 * Converts Google Drive share links into direct view URLs that can be rendered
 * inside standard <img> tags, HTML canvas, and PDF generators without CORS/display issues.
 */

export function convertGoogleDriveUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Match pattern: /file/d/FILE_ID/ or /file/d/FILE_ID
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  // 2. Match pattern: drive.google.com or docs.google.com with ?id=FILE_ID or &id=FILE_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1] && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  // 3. Match pattern: lh3.googleusercontent.com/d/FILE_ID
  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    return `https://lh3.googleusercontent.com/d/${lh3Match[1]}`;
  }

  // 4. Match pattern: drive.google.com/thumbnail?id=FILE_ID
  const thumbMatch = trimmed.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (thumbMatch && thumbMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${thumbMatch[1]}`;
  }

  return trimmed;
}

export function isGoogleDriveUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('lh3.googleusercontent.com');
}

export function getDirectImageUrl(input: string | null | undefined): string {
  if (!input) return '';
  if (isGoogleDriveUrl(input)) {
    return convertGoogleDriveUrl(input);
  }
  return input;
}

/**
 * Asynchronously converts an image URL (including Google Drive URLs) to a Base64 Data URL
 * suitable for jsPDF or html2canvas rendering.
 */
export async function ensureDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const directUrl = convertGoogleDriveUrl(url);
  if (!directUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width || 300;
        const h = img.naturalHeight || img.height || 300;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill pure white background to prevent black background artifacts on transparent PNGs in jsPDF
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          // Export as JPEG with white backing to ensure flawless PDF rendering
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve(dataUrl);
        } else {
          resolve(directUrl);
        }
      } catch (err) {
        console.warn('Canvas conversion failed, fallback to direct URL:', err);
        resolve(directUrl);
      }
    };
    img.onerror = () => {
      resolve(directUrl);
    };
    img.src = directUrl;
  });
}
