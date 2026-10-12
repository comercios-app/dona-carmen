import { IMAGE_BUCKET, imageUrl, supabase } from "./supabase"
import { MAX_IMAGE_BYTES } from "./imageCompression"

export async function saveProductImage(product, blob) {
  let path = null
  if (blob) {
    if (blob.type !== 'image/webp' || blob.size > MAX_IMAGE_BYTES || !blob.size) throw new Error("La foto debe estar optimizada antes de subirla.")
    path = `${product.id}/${crypto.randomUUID()}.webp`
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
      contentType: 'image/webp', cacheControl: '31536000', upsert: false,
    })
    if (error) throw new Error("No se pudo subir la foto. La foto actual sigue igual. Revisá la conexión e intentá nuevamente.")
  }
  const { data, error } = await supabase.rpc('save_product_image', {
    target_id: product.id, new_path: path, expected_version: product.imageVersion,
  })
  if (error) {
    // Con una respuesta perdida no se sabe si el guardado se confirmó: nunca
    // borrar el archivo nuevo aquí, porque podría ser la foto activa.
    if (error.message.includes('IMAGE_CONFLICT')) {
      // Conflicto confirmado: este archivo único no pudo quedar asociado.
      if (path) await supabase.storage.from(IMAGE_BUCKET).remove([path]).catch(() => {})
      throw new Error("Otro dispositivo cambió esta foto. Recargá los productos antes de volver a guardar.")
    }
    throw new Error("No pudimos confirmar el guardado. Recargá los productos para comprobar la foto antes de reintentar.")
  }
  let cleanupPending = false
  if (data.previous_path) {
    try {
      const { error: cleanupError } = await supabase.storage.from(IMAGE_BUCKET).remove([data.previous_path])
      cleanupPending = Boolean(cleanupError)
    } catch { cleanupPending = true }
  }
  return {
    imagePath: data.image_path, imageVersion: data.version,
    imagen: data.image_path ? imageUrl(data.image_path) : product.originalImage,
    cleanupPending,
  }
}
