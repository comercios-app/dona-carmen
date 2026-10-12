export const MAX_PRICE = 10000000

export function parsePrice(value) {
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) throw new Error("Ingresá un importe en pesos enteros, sin puntos ni comas.")
  const price = Number(text)
  if (!Number.isSafeInteger(price) || price < 1 || price > MAX_PRICE) {
    throw new Error("El precio debe estar entre $1 y $10.000.000.")
  }
  return price
}

export function mergePrices(products, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return products.map((product) => {
    const row = byId.get(product.id)
    if (!row || !Number.isInteger(row.price) || row.price < 1 || row.price > MAX_PRICE || !Number.isInteger(row.version)) {
      throw new Error("La lista de precios está incompleta. Intentá nuevamente.")
    }
    return { ...product, precio: row.price, version: row.version }
  })
}

export function reconcileCart(cart, products) {
  const byId = new Map(products.map((product) => [product.id, product]))
  let changed = false
  const items = cart.map((item) => {
    const product = byId.get(item.id)
    if (!product) throw new Error("Un producto del pedido ya no está disponible.")
    if (product.precio !== item.precio) changed = true
    return { ...item, precio: product.precio }
  })
  return { items, changed }
}

export const money = (price) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
}).format(price)
