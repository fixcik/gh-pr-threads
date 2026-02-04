import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Global state path for image storage
let currentStatePath: string | null = null;

/**
 * Set the current state path for image storage
 */
export function setImageStoragePath(statePath: string): void {
  currentStatePath = statePath;
}

/**
 * Get images directory path based on state path
 */
function getImagesDir(): string | null {
  if (!currentStatePath) return null;
  const stateDir = path.dirname(currentStatePath);
  const imagesDir = path.join(stateDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

/**
 * Generate a short hash for the URL to use as filename
 */
function urlToFilename(url: string): string {
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  // Try to extract extension from URL
  const extMatch = url.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
  return `${hash}.${ext}`;
}

/**
 * Check if terminal supports inline images
 */
export function supportsInlineImages(): boolean {
  // iTerm2
  if (process.env.TERM_PROGRAM === 'iTerm.app') {
    return true;
  }
  // Kitty
  if (process.env.KITTY_WINDOW_ID) {
    return true;
  }
  // WezTerm
  if (process.env.TERM_PROGRAM === 'WezTerm') {
    return true;
  }
  return false;
}


/**
 * Generate iTerm2 inline image escape sequence
 */
function iterm2InlineImage(base64Data: string, alt?: string): string {
  // iTerm2 escape sequence for inline images
  // Format: ESC ] 1337 ; File = [arguments] : base64 BEL
  const name = alt ? Buffer.from(alt).toString('base64') : '';
  return `\x1b]1337;File=inline=1;width=auto;height=auto${name ? `;name=${name}` : ''}:${base64Data}\x07`;
}

/**
 * Generate Kitty inline image escape sequence
 */
function kittyInlineImage(base64Data: string): string {
  // Kitty graphics protocol
  // For simplicity, we'll use the transmission mode
  const chunks: string[] = [];
  const chunkSize = 4096;

  for (let i = 0; i < base64Data.length; i += chunkSize) {
    const chunk = base64Data.slice(i, i + chunkSize);
    const isLast = i + chunkSize >= base64Data.length;
    const m = isLast ? 0 : 1;

    if (i === 0) {
      chunks.push(`\x1b_Ga=T,f=100,m=${m};${chunk}\x1b\\`);
    } else {
      chunks.push(`\x1b_Gm=${m};${chunk}\x1b\\`);
    }
  }

  return chunks.join('');
}

/**
 * Download and save image to disk, return local file path
 */
function downloadAndSaveImage(url: string): string | null {
  const imagesDir = getImagesDir();
  if (!imagesDir) return null;

  const filename = urlToFilename(url);
  const filePath = path.join(imagesDir, filename);

  // Check if already downloaded
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    let curlCmd: string;

    // Check if it's a GitHub URL that needs authentication
    if (url.includes('github.com') || url.includes('githubusercontent.com')) {
      const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
      curlCmd = `curl -s -L -H "Authorization: token ${token}" "${url}" -o "${filePath}"`;
    } else {
      curlCmd = `curl -s -L "${url}" -o "${filePath}"`;
    }

    execSync(curlCmd, { timeout: 15000 });

    // Verify file was created and has content
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      return filePath;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Render inline image if supported, otherwise save to disk and return file:// URL
 */
export function renderImage(url: string, alt?: string): string {
  // Always download and save locally first
  const localPath = downloadAndSaveImage(url);

  if (!supportsInlineImages()) {
    if (localPath) {
      const label = alt && alt !== 'image' ? `${alt}: ` : '';
      return `🖼️  ${label}file://${localPath}`;
    }
    // Fallback to original URL if download failed
    const label = alt && alt !== 'image' ? `${alt}: ` : '';
    return `🖼️  ${label}${url}`;
  }

  // For inline images, read from local file (already downloaded with auth)
  if (!localPath) {
    return `🖼️  ${url}`;
  }

  try {
    const imageData = fs.readFileSync(localPath);
    const base64Data = imageData.toString('base64');

    if (process.env.KITTY_WINDOW_ID) {
      return kittyInlineImage(base64Data);
    }

    // iTerm2 or WezTerm (both support iTerm2 protocol)
    return iterm2InlineImage(base64Data, alt);
  } catch {
    return `🖼️  file://${localPath}`;
  }
}

/**
 * Extract image URL from HTML img tag
 */
export function extractImageUrl(imgTag: string): { url: string; alt?: string } | null {
  const srcMatch = imgTag.match(/src=["']([^"']+)["']/);
  if (!srcMatch) return null;

  const altMatch = imgTag.match(/alt=["']([^"']+)["']/);

  return {
    url: srcMatch[1],
    alt: altMatch?.[1]
  };
}

/**
 * Process HTML content and replace img tags with inline images or URLs
 */
export function processImages(content: string): string {
  // Match img tags
  const imgRegex = /<img[^>]+>/gi;

  return content.replace(imgRegex, (match) => {
    const imgData = extractImageUrl(match);
    if (!imgData) return match;

    return '\n' + renderImage(imgData.url, imgData.alt) + '\n';
  });
}
