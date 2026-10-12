import { useEffect, useRef, useState } from "react"
import { compressImage } from "../lib/imageCompression"
import { saveProductImage } from "../lib/productImages"

const action = "rounded-xl border border-zinc-600 px-3 py-2 text-sm disabled:opacity-50"
const size = (bytes) => `${Math.ceil(bytes / 1024)} KB`

export default function ProductImageEditor({ product, disabled, onSaved }) {
  const [prepared, setPrepared] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url) }, [prepared])
  useEffect(() => {
    if (!prepared && !busy) return
    const warn = (event) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [prepared, busy])

  async function choose(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const operation = ++request.current
    setBusy(true)
    setPrepared(null)
    setMessage("Preparando foto…")
    try {
      const result = await compressImage(file)
      if (request.current !== operation) return
      setPrepared({ ...result, url: URL.createObjectURL(result.blob) })
      setMessage("")
    } catch (error) { if (request.current === operation) setMessage(error.message) }
    finally { if (request.current === operation) setBusy(false) }
  }

  async function save(restore = false) {
    if (restore && !window.confirm(`¿Volver a la foto original de ${product.nombre}?`)) return
    setBusy(true)
    setMessage("Guardando foto…")
    try {
      const result = await saveProductImage(product, restore ? null : prepared.blob)
      onSaved(product.id, result)
      setPrepared(null)
      setMessage(result.cleanupPending ? "Foto guardada. No pudimos eliminar el archivo anterior; se podrá limpiar más tarde." : "Foto guardada. Ya está disponible en el menú.")
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <section aria-label={`Foto de ${product.nombre}`} className="mt-3 border-t border-zinc-700 pt-3 sm:col-span-2">
    <div className="flex flex-wrap items-start gap-4">
      <img src={prepared?.url ?? product.imagen} alt={prepared ? `Vista previa de ${product.nombre}` : product.nombre} loading="lazy" className="h-28 w-40 rounded-xl bg-zinc-900 object-cover" />
      <div className="min-w-0 flex-1 space-y-2">
        <label className="block text-sm">Cambiar foto de {product.nombre}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={disabled || busy} className="mt-2 block w-full max-w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:p-2 file:text-white" />
        </label>
        {prepared && <>
          <p className="text-sm text-zinc-300">{size(prepared.originalSize)} → {size(prepared.blob.size)} · {prepared.width} × {prepared.height} px. Vista previa, todavía sin guardar.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || busy} className={`${action} bg-orange-500`} onClick={() => save()}>Guardar foto</button>
            <button type="button" disabled={disabled || busy} className={action} onClick={() => { setPrepared(null); setMessage("") }}>Cancelar foto</button>
          </div>
        </>}
        {!prepared && product.imagePath && <button type="button" disabled={disabled || busy} className={action} onClick={() => save(true)}>Volver a la foto original</button>}
        {message && <p role="status" className="text-sm text-orange-300">{message}</p>}
      </div>
    </div>
  </section>
}
