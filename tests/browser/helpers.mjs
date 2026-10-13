import { readFileSync } from 'node:fs'

const user = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' }
const source = readFileSync(new URL('../../src/data/productos.js', import.meta.url), 'utf8')
const mockImage = readFileSync(new URL('../../src/assets/empanadas.webp', import.meta.url))

export async function mockApi(page, { allowed = true, conflict = false } = {}) {
  const prices = [...source.matchAll(/id: (\d+),\s+nombre: "[^"]+",\s+precio: (\d+)/g)].map((m) => ({ id: Number(m[1]), price: Number(m[2]), version: 1 }))
  const state = { prices, saved: [], history: [], failRead: false, images: prices.map(p => ({ product_id: p.id, image_path: null, version: 1 })), uploads: [], removed: [], imageSaves: [], imageConflict: false, uploadFailure: false }
  const metadata = [...source.matchAll(/id: (\d+),\s+nombre: "([^"]+)",\s+precio: \d+,\s+categoria: "([^"]+)"/g)]
  const names = ['Sanguches de Miga', ...new Set(metadata.map(m => m[3]).filter(c => c !== 'Sanguches de Miga'))]
  state.categories = names.map((name, i) => ({ id: i + 1, name, sort_order: (i + 1) * 10, archived: false, version: 1 }))
  state.products = metadata.map(m => ({ id: Number(m[1]), name: m[2], category_id: names.indexOf(m[3]) + 1, sort_order: Number(m[1]), archived: false, catalog_version: 1 }))
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
    if (url.pathname.endsWith('/get_catalog')) {
      if (state.failRead) return fulfill({ message: 'unavailable' }, 503)
      const all = route.request().postDataJSON().include_archived
      if (all && !allowed) return fulfill({ message: 'NOT_ADMIN' }, 403)
      const categories = state.categories.filter(c => all || !c.archived).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      const products = state.products.filter(p => (all || !p.archived) && categories.some(c => c.id === p.category_id)).map(p => {
        const price = state.prices.find(row => row.id === p.id)
        const image = state.images.find(row => row.product_id === p.id)
        return { ...p, price: price.price, version: price.version, image_path: image.image_path, image_version: image.version }
      }).sort((a, b) => categories.findIndex(c => c.id === a.category_id) - categories.findIndex(c => c.id === b.category_id) || a.sort_order - b.sort_order || a.id - b.id)
      return fulfill({ categories, products })
    }
    if (url.pathname.endsWith('/save_catalog_category')) {
      const { input } = route.request().postDataJSON()
      if (state.catalogConflict) return fulfill({ message: 'CATALOG_CONFLICT' }, 400)
      if (input.archived && state.products.some(p => p.category_id === input.id && !p.archived)) return fulfill({ message: 'CATEGORY_HAS_PRODUCTS' }, 400)
      if (input.id) {
        const c = state.categories.find(c => c.id === input.id)
        Object.assign(c, { name: input.name, sort_order: input.sort_order, archived: input.archived, version: c.version + 1 })
        return fulfill(c.id)
      }
      const id = Math.max(0, ...state.categories.map(c => c.id)) + 1
      state.categories.push({ id, name: input.name, sort_order: input.sort_order, archived: input.archived, version: 1 })
      return fulfill(id)
    }
    if (url.pathname.endsWith('/save_catalog_product')) {
      const { input } = route.request().postDataJSON()
      if (state.catalogConflict) return fulfill({ message: 'CATALOG_CONFLICT' }, 400)
      if (!input.archived && state.categories.find(c => c.id === input.category_id)?.archived) return fulfill({ message: 'CATEGORY_UNAVAILABLE' }, 400)
      if (input.id) {
        const p = state.products.find(p => p.id === input.id)
        Object.assign(p, { name: input.name, category_id: input.category_id, sort_order: input.sort_order, archived: input.archived, catalog_version: p.catalog_version + 1 })
        const price = state.prices.find(p => p.id === input.id)
        if (price.price !== input.price) { price.price = input.price; price.version++ }
        return fulfill(p.id)
      }
      const id = Math.max(0, ...state.products.map(p => p.id)) + 1
      state.products.push({ id, name: input.name, category_id: input.category_id, sort_order: input.sort_order, archived: input.archived, catalog_version: 1 })
      state.prices.push({ id, price: input.price, version: 1 })
      state.images.push({ product_id: id, image_path: null, version: 1 })
      return fulfill(id)
    }
    if (url.pathname.endsWith('/product_prices')) return state.failRead ? fulfill({ message: 'unavailable' }, 503) : fulfill(prices)
    if (url.pathname.endsWith('/product_images')) return fulfill(state.images)
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (route.request().method() === 'GET') return state.failImages
        ? route.fulfill({ status: 404, body: '' })
        : route.fulfill({ status: 200, contentType: 'image/webp', body: mockImage })
      if (route.request().method() === 'DELETE') {
        state.removed.push(...route.request().postDataJSON().prefixes)
        return fulfill([])
      }
      if (state.uploadFailure) return fulfill({ message: 'Upload failed' }, 400)
      state.uploads.push({ path: url.pathname, size: route.request().postDataBuffer()?.length ?? 0 })
      return fulfill({ Key: url.pathname })
    }
    if (url.pathname.endsWith('/save_product_image')) {
      if (state.imageConflict) return fulfill({ message: 'IMAGE_CONFLICT', code: 'P0001' }, 400)
      const input = route.request().postDataJSON()
      state.imageSaves.push(input)
      const row = state.images.find(p => p.product_id === input.target_id)
      const previous = row.image_path
      row.image_path = input.new_path
      row.version++
      return fulfill({ image_path: row.image_path, version: row.version, previous_path: previous })
    }
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

export async function login(page) {
  await page.goto('/#/admin')
  await page.getByLabel('Correo', { exact: true }).fill(user.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}

