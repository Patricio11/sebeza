/**
 * 2026-08  storage-key helpers shared by the upload pipeline and the
 * signed-URL readers (kept dependency-free so importing them never
 * drags sharp into a read path).
 *
 * Photos minted by the WebP pipeline (`…/photos/{id}.webp`) always have
 * a 256px sibling at `…/photos/{id}.thumb.webp`. Legacy jpg/png keys
 * pre-date the pipeline and have no thumb.
 */

export function photoThumbKey(key: string): string {
  return key.replace(/\.webp$/, ".thumb.webp");
}

export function hasPhotoThumb(key: string): boolean {
  return /\/photos\/[^/]+\.webp$/.test(key) && !key.endsWith(".thumb.webp");
}
