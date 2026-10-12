import { createClient } from "@supabase/supabase-js"
import { productos } from "../data/productos"
import { mergePrices } from "./prices"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null
export const livePricesEnabled = import.meta.env.VITE_LIVE_PRICES === "true"

export async function fetchPrices() {
  if (!supabase) throw new Error("Falta configurar la conexión de precios.")
  const { data, error } = await supabase.from("product_prices")
    .select("id,price,version").abortSignal(AbortSignal.timeout(12000))
  if (error) throw new Error("No pudimos consultar los precios. Revisá la conexión e intentá nuevamente.")
  return mergePrices(productos, data)
}

export async function savePrices(changes) {
  const { error } = await supabase.rpc("save_prices", { changes })
  if (error) {
    if (error.message.includes("PRICE_CONFLICT")) throw new Error("Otro dispositivo cambió un precio. Recargá la lista y revisá tus cambios antes de guardar.")
    if (error.message.includes("NOT_ADMIN")) throw new Error("Tu usuario no tiene permiso para cambiar precios.")
    throw new Error("No pudimos confirmar el guardado. Recargá la lista para verificar los valores antes de reintentar.")
  }
}
