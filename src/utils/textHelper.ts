/**
 * Centralized Text & Class Name Helpers
 */

/**
 * Strips clock time intervals like (07:30 - 09:00) from jam strings
 */
export function stripClockFromJamString(jamStr?: string): string {
  if (!jamStr) return '';
  return jamStr
    .replace(/\s*\(\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2}\)/gi, '')
    .replace(/\b\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2}\b/gi, '')
    .trim();
}

/**
 * Standardizes a class name to a normalized key for consistent matching across all modules.
 * Examples:
 *   "Kelas 8.1"  -> "8.1"
 *   "8.1"        -> "8.1"
 *   "kelas 8-1"  -> "8.1"
 *   "Kelas  8.1" -> "8.1"
 *   "8_1"        -> "8.1"
 *   "Kelas 8.10" -> "8.10"
 *   "Semua"      -> "all"
 *   "all"        -> "all"
 */
export function normalizeClassKey(className?: string): string {
  if (!className) return '';
  let trimmed = className.trim().toLowerCase();
  if (trimmed === 'semua' || trimmed === 'all') return 'all';

  trimmed = trimmed.replace(/^kelas\s+/i, '');

  // Convert Roman numerals at the beginning of class name (e.g. viii.1 -> 8.1, vii -> 7, ix -> 9)
  trimmed = trimmed
    .replace(/^viii([.\s_-]|$)/i, '8$1')
    .replace(/^vii([.\s_-]|$)/i, '7$1')
    .replace(/^ix([.\s_-]|$)/i, '9$1')
    .replace(/^xii([.\s_-]|$)/i, '12$1')
    .replace(/^xi([.\s_-]|$)/i, '11$1')
    .replace(/^x([.\s_-]|$)/i, '10$1');

  return trimmed
    .replace(/[\s_-]+/g, '.')
    .replace(/\.+/g, '.')
    .trim();
}

/**
 * Checks if two class names refer to the same class, safely handling
 * various formatting nuances ("Kelas 8.1" vs "8.1" vs "8-1").
 */
export function isClassMatch(classA?: string, classB?: string): boolean {
  if (!classA && !classB) return true;
  if (!classA || !classB) return false;
  if (classA === classB) return true;
  
  const normA = normalizeClassKey(classA);
  const normB = normalizeClassKey(classB);
  
  if (!normA || !normB) return false;
  if (normA === 'all' || normB === 'all') return true;
  
  return normA === normB;
}

/**
 * Formats a normalized key or raw string into standard "Kelas X.Y" display title.
 */
export function formatDisplayClassName(className?: string): string {
  if (!className) return '';
  const norm = normalizeClassKey(className);
  if (!norm || norm === 'all') return 'Semua Kelas';
  return `Kelas ${norm}`;
}
