import { useEffect, useState } from "react"
import { fetchPrices, savePrices, supabase } from "../lib/supabase"
import { money, parsePrice } from "../lib/prices"

const field = "w-full rounded-xl border border-zinc-600 bg-zinc-900 p-3 text-white"
const button = "rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white disabled:opacity-50"

export default function Admin() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [recovery, setRecovery] = useState(() => new URLSearchParams(window.location.search).get("recovery") === "1")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setChecking(false)
      if (event === "PASSWORD_RECOVERY") setRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function login(event) {
    event.preventDefault()
    setBusy(true)
    setNotice("")
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      setPassword("")
    } catch {
      setNotice("No pudimos ingresar. Revisá tu correo, contraseña y conexión.")
    } finally { setBusy(false) }
  }

  async function recover() {
    if (!email.trim()) { setNotice("Ingresá tu correo para recuperar el acceso."); return }
    setBusy(true)
    try {
      const redirect = `${window.location.origin}${import.meta.env.BASE_URL}?admin=1&recovery=1`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect })
      if (error) throw error
      setNotice("Si el correo tiene una cuenta, recibirás un enlace para cambiar la contraseña. Revisá también spam.")
    } catch { setNotice("No se pudo enviar el enlace. Intentá más tarde.") }
    finally { setBusy(false) }
  }

  async function updatePassword(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setPassword("")
      setRecovery(false)
      window.history.replaceState(null, "", `${import.meta.env.BASE_URL}#/admin`)
      setNotice("Contraseña actualizada.")
    } catch { setNotice("No se pudo cambiar la contraseña. Usá al menos 12 caracteres o solicitá un enlace nuevo.") }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setNotice("")
    } catch { setNotice("No se pudo cerrar sesión. Intentá nuevamente.") }
    finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-8">
    <div className="mx-auto max-w-5xl">
      <a href={import.meta.env.BASE_URL} className="text-orange-300">← Volver al menú</a>
      <h1 className="mt-6 text-3xl font-bold">Precios de Doña Carmen</h1>
      <p className="mt-2 text-zinc-400">Administración</p>
      {notice && <p role="status" className="my-4 rounded-xl border border-orange-400 p-4">{notice}</p>}
      {!supabase ? <p className="mt-6">La administración todavía no está configurada.</p>
        : checking ? <p className="mt-6">Verificando acceso…</p>
        : recovery && session ? <form onSubmit={updatePassword} className="mt-6 max-w-md space-y-4">
          <label className="block">Nueva contraseña<input className={field} type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className={button} disabled={busy}>Guardar contraseña</button>
        </form>
        : !session ? <form onSubmit={login} className="mt-6 max-w-md space-y-4">
          {recovery && <p>Si tu enlace venció, solicitá uno nuevo con tu correo.</p>}
          <label className="block">Correo<input className={field} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block">Contraseña<input className={field} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className={button} disabled={busy}>{busy ? "Procesando…" : "Ingresar"}</button>
          <button className="block py-3 text-orange-300" type="button" onClick={recover} disabled={busy}>Olvidé mi contraseña</button>
        </form>
        : <>
          <div className="my-6 flex flex-wrap items-center justify-between gap-3"><p>{session.user.email}</p><button className={button} onClick={logout} disabled={busy}>Cerrar sesión</button></div>
          <PriceEditor key={session.user.id} />
        </>}
    </div>
  </main>
}

async function loadEditorData() {
  const { data: admin, error: authError } = await supabase.rpc("is_price_admin")
  if (authError || !admin) throw new Error("Tu cuenta no tiene acceso al panel, o falta completar la configuración del proyecto.")
  const products = await fetchPrices()
  const { data: history, error } = await supabase.from("price_history").select("id,product_id,old_price,new_price,changed_at,changed_by").order("id", { ascending: false }).limit(100)
  if (error) throw new Error("No se pudo cargar el historial. Intentá nuevamente.")
  return { products, history }
}

function PriceEditor() {
  const [products, setProducts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [history, setHistory] = useState([])
  const [allowed, setAllowed] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [review, setReview] = useState(null)

  async function load() {
    try {
      const data = await loadEditorData()
      setAllowed(true)
      setProducts(data.products)
      setHistory(data.history)
      setDrafts({})
      setReview(null)
      return true
    } catch (error) { setAllowed(false); setMessage(error.message); return false }
    finally { setBusy(false) }
  }

  useEffect(() => {
    let active = true
    loadEditorData().then((data) => {
      if (!active) return
      setProducts(data.products)
      setHistory(data.history)
      setAllowed(true)
    }).catch((error) => { if (active) setMessage(error.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [])
  const dirty = Object.keys(drafts).length > 0
  useEffect(() => {
    if (!dirty) return
    const warn = (event) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function edit(id, value) {
    setReview(null)
    setDrafts((prev) => ({ ...prev, [id]: value }))
  }

  function prepare() {
    try {
      const changes = products.filter((p) => drafts[p.id] !== undefined).map((p) => ({
        id: p.id, price: parsePrice(drafts[p.id]), expected_version: p.version,
        name: p.nombre, old: p.precio,
      })).filter((p) => p.price !== p.old)
      if (!changes.length) { setMessage("No hay precios nuevos para guardar."); return }
      setReview(changes)
      setMessage("")
    } catch (error) { setMessage(error.message) }
  }

  async function save() {
    setBusy(true)
    try {
      await savePrices(review.map(({ id, price, expected_version }) => ({ id, price, expected_version })))
      setDrafts({})
      setReview(null)
      const loaded = await load()
      if (loaded) setMessage("Precios guardados. Ya están disponibles para el menú.")
    } catch (error) { setMessage(error.message); setReview(null) }
    finally { setBusy(false) }
  }

  function reload() {
    if (!dirty || window.confirm("Se descartarán los cambios sin guardar. ¿Recargar los precios?")) {
      setBusy(true)
      setMessage("")
      void load()
    }
  }

  const visible = products.filter((p) => (!category || category === p.categoria) && p.nombre.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")))
  return <section>
    {message && <p role="status" className="my-4 rounded-xl border border-orange-400 p-4">{message}</p>}
    <button className="my-3 underline disabled:opacity-50" disabled={busy} onClick={reload}>Recargar precios e historial</button>
    {busy && <p role="status">Procesando…</p>}
    {allowed && <>
      <p className="mb-4 text-zinc-300">Cada presentación se modifica por separado. Los sánguches de media docena y docena mantienen el precio por sánguche.</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <label>Buscar producto<input className={field} type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label>Categoría<select className={field} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{[...new Set(products.map((p) => p.categoria))].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <fieldset disabled={busy} className="space-y-3">
        {visible.map((p) => <div key={p.id} className="grid items-center gap-3 rounded-xl bg-zinc-800 p-4 sm:grid-cols-[1fr_12rem]">
          <div><p className="font-semibold">{p.nombre}</p><p className="text-sm text-zinc-400">{p.categoria} · Actual: {money(p.precio)}</p></div>
          <label className="text-sm">Nuevo precio ($)<input aria-label={`Precio de ${p.nombre}`} className={field} inputMode="numeric" value={drafts[p.id] ?? String(p.precio)} onChange={(e) => edit(p.id, e.target.value)} /></label>
        </div>)}
        {!visible.length && <p>No hay productos que coincidan.</p>}
      </fieldset>
      <div className="sticky bottom-0 mt-4 border-t border-zinc-700 bg-zinc-950 py-4"><button className={button} disabled={busy || !dirty} onClick={prepare}>Revisar cambios</button></div>
      {review && <section aria-label="Revisión de precios" className="my-5 rounded-xl border border-orange-500 p-5">
        <h2 className="text-xl font-bold">Confirmá los nuevos precios</h2>
        <ul className="my-4 space-y-2">{review.map((p) => <li key={p.id}>{p.name}: {money(p.old)} → <strong>{money(p.price)}</strong></li>)}</ul>
        <div className="flex gap-4"><button className={button} disabled={busy} onClick={save}>Guardar precios</button><button disabled={busy} onClick={() => setReview(null)}>Seguir editando</button></div>
      </section>}
      <h2 className="mb-4 mt-8 text-2xl font-bold">Últimos cambios</h2>
      <p className="mb-3 text-sm text-zinc-400">Se muestran hasta 100 cambios. Restaurar prepara un importe anterior; revisalo y guardalo para aplicarlo.</p>
      {!history.length && <p>Todavía no hay cambios registrados.</p>}
      <div className="space-y-3">{history.map((entry) => {
        const product = products.find((p) => p.id === entry.product_id)
        return <div key={entry.id} className="rounded-xl bg-zinc-800 p-4">
          <p>{product?.nombre ?? entry.product_id}: {money(entry.old_price)} → {money(entry.new_price)}</p>
          <p className="text-sm text-zinc-400">{new Date(entry.changed_at).toLocaleString("es-AR")} · Usuario: {entry.changed_by}</p>
          <button className="mt-2 text-orange-300 disabled:opacity-50" disabled={busy || !product} onClick={() => { edit(entry.product_id, String(entry.old_price)); setMessage("Precio anterior preparado. Tocá Revisar cambios para continuar.") }}>Restaurar {money(entry.old_price)}</button>
        </div>
      })}</div>
    </>}
  </section>
}
