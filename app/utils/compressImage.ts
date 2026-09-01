/**
 * Browser-side receipt compression.
 *
 * Receipts arrive as 1–3 MB phone photos. The original is kept in R2 untouched
 * for audit, but serving it to a 100px thumbnail or embedding it in a PDF is
 * wasteful, so a smaller copy is produced here at upload time.
 *
 * This runs in the browser on purpose: Cloudflare's image resizing needs a
 * paid zone on a custom domain, and doing it in the Worker would burn CPU on
 * every upload for no benefit.
 */

export const DISPLAY_MAX_EDGE = 1600
export const DISPLAY_QUALITY = 0.75

/** Below this, re-encoding gains nothing worth a second object in R2. */
const SKIP_UNDER_BYTES = 300 * 1024

export interface CompressedImage {
  blob: Blob
  contentType: string
  width: number
  height: number
}

function canEncode(type: string): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL(type).startsWith(`data:${type}`)
}

let preferredType: string | null = null

function displayType(): string {
  if (preferredType) return preferredType
  preferredType = canEncode('image/webp') ? 'image/webp' : 'image/jpeg'
  return preferredType
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

/**
 * Returns a smaller re-encode, or null when one is not worth making (already
 * small, not an image, or the browser could not decode it). A null result is
 * not an error — the original is then served as before.
 */
export async function compressImage(file: File): Promise<CompressedImage | null> {
  if (!file.type.startsWith('image/')) return null
  if (file.size < SKIP_UNDER_BYTES) return null

  let bitmap: ImageBitmap
  try {
    // `from-image` applies the EXIF rotation phone cameras rely on. Without it
    // portrait receipts come out sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }

  try {
    const scale = Math.min(1, DISPLAY_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    const type = displayType()
    const blob = await toBlob(canvas, type, DISPLAY_QUALITY)

    // If the re-encode came out no smaller, keep serving the original.
    if (!blob || blob.size >= file.size) return null

    return { blob, contentType: type, width, height }
  } finally {
    bitmap.close()
  }
}

export function displayFilename(original: string, contentType: string): string {
  const ext = contentType === 'image/webp' ? 'webp' : 'jpg'
  const stem = original.includes('.') ? original.slice(0, original.lastIndexOf('.')) : original
  return `${stem}.display.${ext}`
}
