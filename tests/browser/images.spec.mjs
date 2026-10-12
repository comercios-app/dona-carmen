import { test, expect } from '@playwright/test'
import { mockApi, login } from './helpers.mjs'

async function photo(page) {
  // Foto de prueba con suficiente detalle para ejercitar reducción y compresión.
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1800
    canvas.height = 1400
    const ctx = canvas.getContext('2d')
    const pixels = ctx.createImageData(canvas.width, canvas.height)
    let seed = 1
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      pixels.data[i] = seed & 255
      pixels.data[i + 1] = (seed >>> 8) & 255
      pixels.data[i + 2] = (seed >>> 16) & 255
      pixels.data[i + 3] = 255
    }
    ctx.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }
}

test('fotos: compresión real, vista previa, guardado, reemplazo y regreso al original', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await mockApi(page)
  await login(page)
  await page.getByLabel('Buscar producto').fill('Hamburguesa')
  const editor = page.getByRole('region', { name: 'Foto de Hamburguesa', exact: true })
  const file = await photo(page)
  await editor.getByLabel('Cambiar foto de Hamburguesa').setInputFiles(file)
  await expect(editor.getByText(/todavía sin guardar/)).toBeVisible({ timeout: 15000 })
  expect(state.uploads).toHaveLength(0)
  const result = await page.evaluate(async () => {
    const img = document.querySelector('img[alt="Vista previa de Hamburguesa"]')
    await img.decode()
    const blob = await (await fetch(img.src)).blob()
    return { width: img.naturalWidth, height: img.naturalHeight, bytes: blob.size, type: blob.type }
  })
  expect(result.width).toBeLessThanOrEqual(1200)
  expect(result.height).toBeLessThanOrEqual(1200)
  expect(result.bytes).toBeLessThanOrEqual(300 * 1024)
  expect(result.bytes).toBeLessThan(file.buffer.length)
  expect(result.type).toBe('image/webp')
  await editor.getByRole('button', { name: 'Guardar foto', exact: true }).click()
  await expect(editor.getByText(/Foto guardada/)).toBeVisible()
  expect(state.imageSaves).toHaveLength(1)
  const oldPath = state.imageSaves[0].new_path
  await editor.getByLabel('Cambiar foto de Hamburguesa').setInputFiles(file)
  await expect(editor.getByRole('button', { name: 'Guardar foto', exact: true })).toBeVisible({ timeout: 15000 })
  await editor.getByRole('button', { name: 'Guardar foto', exact: true }).click()
  await expect(editor.getByText(/Foto guardada/)).toBeVisible()
  expect(state.removed).toContain(oldPath)
  page.on('dialog', dialog => dialog.accept())
  await editor.getByRole('button', { name: 'Volver a la foto original' }).click()
  await expect(editor.getByRole('button', { name: 'Volver a la foto original' })).toHaveCount(0)
  expect(state.images.find(row => row.product_id === 1).image_path).toBeNull()
  expect(state.saved).toHaveLength(0)
})

test('fotos: archivo inválido, cancelar y error de subida conservan la foto actual', async ({ page }) => {
  const state = await mockApi(page)
  await login(page)
  await page.getByLabel('Buscar producto').fill('Hamburguesa')
  const editor = page.getByRole('region', { name: 'Foto de Hamburguesa', exact: true })
  const input = editor.getByLabel('Cambiar foto de Hamburguesa')
  await input.setInputFiles({ name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') })
  await expect(editor.getByText(/No pudimos abrir/)).toBeVisible()
  const file = await photo(page)
  await input.setInputFiles(file)
  await editor.getByRole('button', { name: 'Cancelar foto' }).click()
  expect(state.uploads).toHaveLength(0)
  await input.setInputFiles(file)
  state.uploadFailure = true
  await editor.getByRole('button', { name: 'Guardar foto', exact: true }).click()
  await expect(editor.getByText(/No se pudo subir/)).toBeVisible()
  expect(state.imageSaves).toHaveLength(0)
  expect(state.images.find(row => row.product_id === 1).image_path).toBeNull()
})

test('fotos: conflicto no reemplaza imagen de otro dispositivo', async ({ page }) => {
  const state = await mockApi(page)
  state.imageConflict = true
  await login(page)
  await page.getByLabel('Buscar producto').fill('Hamburguesa')
  const editor = page.getByRole('region', { name: 'Foto de Hamburguesa', exact: true })
  await editor.getByLabel('Cambiar foto de Hamburguesa').setInputFiles(await photo(page))
  await editor.getByRole('button', { name: 'Guardar foto', exact: true }).click()
  await expect(editor.getByText(/Otro dispositivo cambió esta foto/)).toBeVisible()
  expect(state.imageSaves).toHaveLength(0)
  expect(state.removed).toHaveLength(1)
})

test('menú: muestra foto remota en categoría y producto; recupera original si falta el archivo', async ({ page }) => {
  const state = await mockApi(page)
  state.images.find(row => row.product_id === 1).image_path = '1/00000000-0000-0000-0000-000000000001.webp'
  await page.goto('/')
  const category = page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Hamburguesas', exact: true }) })
  await expect(category.locator('img')).toHaveAttribute('src', /storage\/v1\/object\/public\/product-images/)
  await category.click()
  const image = page.getByRole('img', { name: 'Hamburguesa', exact: true })
  await expect(image).toHaveAttribute('src', /storage\/v1\/object\/public\/product-images/)
  await image.evaluate(img => img.decode())
  state.failImages = true
  await page.reload()
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Hamburguesas', exact: true }) }).click()
  await expect(page.getByRole('img', { name: 'Hamburguesa', exact: true })).toHaveAttribute('src', /hamburguesa\.jpg/)
})
