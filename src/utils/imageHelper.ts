/**
 * Image helper utilities for NOVASOL Warehouse:
 * - Local file picker & canvas compressor (data URL)
 * - Google Drive link parser & conversion to direct lh3.googleusercontent.com/d/{ID} link
 */

/**
 * Extracts Google Drive File ID from various link formats:
 * - https://drive.google.com/file/d/1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO/view?usp=sharing
 * - https://drive.google.com/open?id=1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO
 * - https://drive.google.com/uc?id=1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO
 * - https://lh3.googleusercontent.com/d/1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO
 * - 1seZ1h5ddiY1CL7ELoXxqSC1pxbbJuBbO (raw ID)
 */
export const extractGoogleDriveId = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: /file/d/{id} or /d/{id}
  const fileDMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Pattern 2: id={id}
  const idQueryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch && idQueryMatch[1]) {
    return idQueryMatch[1];
  }

  // Pattern 3: raw Drive ID (typically 28-44 chars alphanumeric with _ or -)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
};

/**
 * Converts any Google Drive link or ID into a high-speed direct lh3 URL:
 * https://lh3.googleusercontent.com/d/{ID}
 */
export const convertToLh3Url = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  
  // If already an lh3 link, return as is
  if (trimmed.startsWith('https://lh3.googleusercontent.com/d/')) {
    return trimmed;
  }

  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  // Return standard URL if not a Drive link
  return trimmed;
};

/**
 * Resizes and compresses an image file using browser HTML5 Canvas.
 * Outputs a lightweight JPEG/PNG Data URL suitable for localStorage and instant display.
 */
export const processLocalImageFile = (
  file: File,
  maxWidth = 640,
  maxHeight = 640,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('ไฟล์ที่เลือกไม่ใช่รูปภาพ'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio scale
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Fill white background for transparent PNG converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight data URL
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    };

    reader.readAsDataURL(file);
  });
};
