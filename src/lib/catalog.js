export function parseOrder(value) {
  if (!/^\d+$/.test(String(value)) || Number(value) > 10000) throw new Error("El orden debe ser un número entero entre 0 y 10000.")
  return Number(value)
}

export function validateName(value, max = 120) {
  const name = value.trim()
  if (!name || name.length > max) throw new Error(`Ingresá un nombre de entre 1 y ${max} caracteres.`)
  return name
}

export function catalogError(error) {
  if (error.message?.includes('CATALOG_CONFLICT')) return 'Otro administrador modificó este registro o su precio. Recargá el catálogo y revisá los datos.'
  if (error.message?.includes('CATEGORY_HAS_PRODUCTS')) return 'Esta categoría todavía tiene productos visibles. Movelos a otra categoría o archivalos primero.'
  if (error.message?.includes('CATEGORY_UNAVAILABLE')) return 'La categoría no está disponible. Elegí una categoría activa o restaurala primero.'
  if (error.message?.includes('NOT_ADMIN')) return 'Tu usuario no tiene permiso para modificar el catálogo.'
  if (error.code === '23505') return 'Ya existe ese nombre, incluso entre los archivados. Usá otro nombre o restaurá el registro existente.'
  return 'No pudimos confirmar el guardado. Recargá el catálogo para verificar los cambios antes de reintentar.'
}
