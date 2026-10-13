import { useEffect, useRef, useState } from 'react'
import { parseOrder, validateName } from '../lib/catalog'
import { money, parsePrice } from '../lib/prices'
import { saveCatalogRecord } from '../lib/supabase'

const field = 'mt-1 w-full rounded-xl border border-zinc-600 bg-zinc-900 p-3 text-white'
const button = 'rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-50'

export default function CatalogRecordForm({ kind, record, categories, onClose, onSaved }) {
  const isProduct = kind === 'product'
  const [name, setName] = useState(record?.nombre ?? record?.name ?? '')
  const [price, setPrice] = useState(String(record?.precio ?? ''))
  const [categoryId, setCategoryId] = useState(String(record?.categoryId ?? categories.find((c) => !c.archived)?.id ?? ''))
  const [sortOrder, setSortOrder] = useState(String(record?.sortOrder ?? record?.sort_order ?? 100))
  const [archived, setArchived] = useState(record?.archived ?? false)
  const [requestId] = useState(() => crypto.randomUUID())
  const [review, setReview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const saving = useRef(false)
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy])

  function close() {
    if (!busy && (!dirty || window.confirm('¿Descartar los cambios sin guardar?'))) onClose()
  }

  function prepare(event) {
    event.preventDefault()
    try {
      const input = {
        id: record?.id ?? null, request_id: requestId,
        name: validateName(name, isProduct ? 120 : 80), sort_order: parseOrder(sortOrder), archived,
        expected_version: isProduct ? record?.catalogVersion : record?.version,
      }
      if (isProduct) {
        const category = categories.find((c) => c.id === Number(categoryId))
        if (!category || (category.archived && !archived)) throw new Error('Elegí una categoría activa para publicar el producto.')
        Object.assign(input, { category_id: category.id, price: parsePrice(price), expected_price_version: record?.version })
      }
      setReview(input)
      setMessage('')
    } catch (error) { setMessage(error.message) }
  }

  async function save() {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    try {
      const id = await saveCatalogRecord(kind, review)
      setDirty(false)
      await onSaved({ id, name: review.name, kind, archived: review.archived })
    } catch (error) { setMessage(error.message); setReview(null) }
    finally { saving.current = false; setBusy(false) }
  }

  const title = `${record ? 'Editar' : isProduct ? 'Nuevo' : 'Nueva'} ${isProduct ? 'producto' : 'categoría'}`
  return <dialog ref={dialog} aria-labelledby="catalog-form-title" onCancel={(event) => { event.preventDefault(); close() }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-zinc-600 bg-zinc-950 p-6 text-white backdrop:bg-black/70">
    <h2 id="catalog-form-title" className="text-2xl font-bold">{title}</h2>
    {message && <p role="alert" className="my-4 text-orange-300">{message}</p>}
    {review ? <section className="mt-4 space-y-4">
      <h3 className="font-bold">Revisá antes de guardar</h3>
      <p>{review.name}</p>
      {isProduct && <p>{categories.find(c => c.id === review.category_id)?.name} · {money(review.price)}</p>}
      <p>Orden: {review.sort_order} · {review.archived ? 'Archivado: no se mostrará en el menú' : 'Activo'}</p>
      {record && review.archived && !record.archived && <p>Se conservarán los datos y podrás restaurarlos más adelante.</p>}
      <div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar y guardar'}</button><button type="button" disabled={busy} onClick={() => setReview(null)}>Seguir editando</button></div>
    </section> : <form onSubmit={prepare} onChange={() => setDirty(true)} className="mt-4 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block">Nombre<input autoFocus required maxLength={isProduct ? 120 : 80} className={field} value={name} onChange={e => setName(e.target.value)} /></label>
        {isProduct && <>
          <label className="block">Categoría del producto<select required className={field} value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Elegí una categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? ' (archivada)' : ''}</option>)}</select></label>
          <label className="block">Precio ($)<input required inputMode="numeric" className={field} value={price} onChange={e => setPrice(e.target.value)} /></label>
          {!record && <p className="text-sm text-zinc-400">Después de crear el producto podrás cargar su foto desde la lista.</p>}
        </>}
        <label className="block">Orden de aparición<input required type="number" min="0" max="10000" step="1" className={field} value={sortOrder} onChange={e => setSortOrder(e.target.value)} /></label>
        <p className="text-sm text-zinc-400">Los números menores aparecen primero.</p>
        <label className="flex items-center gap-3"><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />Archivado (oculto en el menú)</label>
        {!isProduct && <p className="text-sm text-zinc-400">Antes de archivar una categoría, mové o archivá sus productos visibles. Restaurar una categoría no restaura automáticamente sus productos.</p>}
        <button className={button} disabled={busy}>Revisar {record ? 'cambios' : 'alta'}</button>
      </fieldset>
    </form>}
    <button type="button" onClick={close} disabled={busy} className="mt-5 underline disabled:opacity-50">Cancelar</button>
  </dialog>
}
