/**
 * Sanitise a filename for use in Supabase Storage keys.
 * Replaces spaces with underscores and strips non-safe characters.
 */
export function sanitiseFilename(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}
