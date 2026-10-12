export const MAX_IMAGE_BYTES = 300 * 1024
const INPUT_LIMIT = 20 * 1024 * 1024

export function imageDimensions(width, height, maxSide = 1200) {
  if (width < 1 || height < 1) throw new Error("La imagen no tiene dimensiones válidas.")
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export async function compressImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error("Elegí una foto JPG, PNG o WebP. Si es HEIC, exportala como JPG primero.")
  }
  if (!file.size || file.size > INPUT_LIMIT) throw new Error("La foto original debe pesar hasta 20 MB.")
  let bitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error("No pudimos abrir esa foto. Probá con otra imagen JPG, PNG o WebP.") }
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error("Tu navegador no puede preparar la foto.")
    // Redimensionar sin recortar ni ampliar; se vuelve a dibujar desde el original.
    for (const side of [1200, 1000, 800, 600]) {
      const dimensions = imageDimensions(bitmap.width, bitmap.height, side)
      canvas.width = dimensions.width
      canvas.height = dimensions.height
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.72, 0.6]) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
        if (!blob || blob.type !== 'image/webp') throw new Error("Actualizá tu navegador para poder preparar la foto en WebP.")
        if (blob.size <= MAX_IMAGE_BYTES) return { blob, ...dimensions, originalSize: file.size }
      }
    }
    throw new Error("No pudimos reducir esta imagen lo suficiente. Probá con otra foto.")
  } finally { bitmap.close() }
}
