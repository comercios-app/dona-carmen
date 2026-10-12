import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const user = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' }
const source = readFileSync(new URL('../../src/data/productos.js', import.meta.url), 'utf8')

async function mockApi(page, { allowed = true, conflict = false } = {}) {
  const prices = [...source.matchAll(/id: (\d+),\s+nombre: "[^"]+",\s+precio: (\d+)/g)].map((m) => ({ id: Number(m[1]), price: Number(m[2]), version: 1 }))
  const state = { prices, saved: [], history: [], failRead: false }
  await page.route('https://test-project.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    const fulfill = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname.endsWith('/token')) {
      const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const token = `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`
      return fulfill({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user })
    }
    if (url.pathname.endsWith('/user')) return fulfill(user)
    if (url.pathname.endsWith('/logout') || url.pathname.endsWith('/recover')) return fulfill({})
    if (url.pathname.endsWith('/is_price_admin')) return fulfill(allowed)
    if (url.pathname.endsWith('/product_prices')) return state.failRead ? fulfill({ message: 'unavailable' }, 503) : fulfill(prices)
    if (url.pathname.endsWith('/price_history')) return fulfill(state.history)
    if (url.pathname.endsWith('/save_prices')) {
      if (conflict) return fulfill({ message: 'PRICE_CONFLICT', code: 'P0001' }, 400)
      const { changes } = route.request().postDataJSON()
      state.saved.push(changes)
      for (const change of changes) {
        const product = prices.find((p) => p.id === change.id)
        state.history.unshift({ id: state.history.length + 1, product_id: product.id, old_price: product.price, new_price: change.price, changed_at: new Date().toISOString(), changed_by: user.id })
        product.price = change.price
        product.version++
      }
      return fulfill(null)
    }
    throw new Error('Unexpected API request: ' + url.pathname)
  })
  return state
}

async function login(page) {
  await page.goto('/#/admin')
  await page.getByLabel('Correo', { exact: true }).fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}

test('administrador: ingreso, revisión, guardado y restauración desde celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await mockApi(page)
  await login(page)
  await page.getByLabel('Buscar producto').fill('Empanadas x 12')
  await page.getByLabel('Precio de Empanadas x 12', { exact: true }).fill('27000')
  await page.getByRole('button', { name: 'Revisar cambios' }).click()
  expect(state.saved).toHaveLength(0)
  await expect(page.getByRole('region', { name: 'Revisión de precios' })).toContainText('27.000')
  await page.getByRole('button', { name: 'Guardar precios', exact: true }).click()
  await expect(page.getByText('Precios guardados.', { exact: false })).toBeVisible()
  expect(state.saved[0]).toEqual([{ id: 3, price: 27000, expected_version: 1 }])
  await page.getByRole('button', { name: /Restaurar/ }).click()
  await page.getByRole('button', { name: 'Revisar cambios' }).click()
  await page.getByRole('button', { name: 'Guardar precios', exact: true }).click()
  await expect(page.getByLabel('Precio de Empanadas x 12', { exact: true })).toHaveValue('25000')
  expect(state.saved[1]).toEqual([{ id: 3, price: 25000, expected_version: 2 }])
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible()
})

test('usuario sin permiso no recibe editor', async ({ page }) => {
  await mockApi(page, { allowed: false })
  await login(page)
  await expect(page.getByText(/Tu cuenta no tiene acceso/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revisar cambios' })).toHaveCount(0)
})

test('conflicto conserva edición y pide recargar', async ({ page }) => {
  await mockApi(page, { conflict: true })
  await login(page)
  await page.getByLabel('Precio de Empanada unidad', { exact: true }).fill('3500')
  await page.getByRole('button', { name: 'Revisar cambios' }).click()
  await page.getByRole('button', { name: 'Guardar precios', exact: true }).click()
  await expect(page.getByText(/Otro dispositivo cambió un precio/)).toBeVisible()
  await expect(page.getByLabel('Precio de Empanada unidad', { exact: true })).toHaveValue('3500')
})

test('pedido actualiza total y detiene envío si cambió un precio o falla la consulta', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/')
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Empanadas', exact: true }) }).click()
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click()
  await page.getByLabel('Nombre:', { exact: true }).fill('Cliente')
  state.prices.find((p) => p.id === 3).price = 28000
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click()
  await expect(page.getByText(/Se actualizaron algunos precios/)).toBeVisible()
  expect(page.url()).toContain('127.0.0.1')
  state.failRead = true
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click()
  await expect(page.getByText(/No pudimos consultar los precios/)).toBeVisible({ timeout: 15000 })
  expect(page.url()).toContain('127.0.0.1')
})

test('recuperación abre formulario y actualiza contraseña', async ({ page }) => {
  await mockApi(page)
  await login(page)
  await expect(page.getByLabel('Buscar producto')).toBeVisible()
  await page.goto('/?admin=1&recovery=1')
  await page.getByLabel('Nueva contraseña').fill('new-test-password-123')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByText('Contraseña actualizada.')).toBeVisible()
  await expect(page.getByLabel('Buscar producto')).toBeVisible()
})
