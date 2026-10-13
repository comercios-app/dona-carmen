import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePrice, mergePrices, reconcileCart } from '../src/lib/prices.js'
import { imageDimensions } from '../src/lib/imageCompression.js'

test('fotos: conserva proporción, limita el lado mayor y no amplía', () => {
  assert.deepEqual(imageDimensions(4000, 3000), { width: 1200, height: 900 })
  assert.deepEqual(imageDimensions(3000, 4000), { width: 900, height: 1200 })
  assert.deepEqual(imageDimensions(320, 200), { width: 320, height: 200 })
  assert.throws(() => imageDimensions(0, 100))
})

test('precios: rechaza formatos ambiguos, negativos y fuera de rango', () => {
  for (const value of ['', '-1', '0', '2.200', '2,200', '1e3', '10000001', 'Infinity']) {
    assert.throws(() => parsePrice(value))
  }
  assert.equal(parsePrice('25000'), 25000)
})

test('catálogo: no usa un precio antiguo si falta una fila remota', () => {
  assert.throws(() => mergePrices([{ id: 1, precio: 10 }], []))
  assert.deepEqual(mergePrices([{ id: 1, precio: 10, nombre: 'Uno' }], [{ id: 1, price: 20, version: 2 }]), [{ id: 1, precio: 20, nombre: 'Uno', version: 2 }])
})

test('carrito: actualiza importes y conserva cantidades para revisión', () => {
  const cart = [{ id: 1, precio: 10, cantidad: 3 }]
  const result = reconcileCart(cart, [{ id: 1, precio: 20 }])
  assert.equal(result.changed, true)
  assert.equal(result.items[0].cantidad * result.items[0].precio, 60)
  assert.equal(cart[0].precio, 10)
  assert.equal(reconcileCart(result.items, [{ id: 1, precio: 20 }]).changed, false)
  assert.deepEqual(reconcileCart(cart, []).items, [])
  assert.equal(reconcileCart(cart, []).changed, true)
})

test('carrito: renombrados se revisan y productos archivados se quitan', () => {
  const cart = [{ id: 1, nombre: 'Antes', precio: 10, cantidad: 2 }, { id: 2, nombre: 'Archivado', precio: 20, cantidad: 1 }]
  const result = reconcileCart(cart, [{ id: 1, nombre: 'Ahora', precio: 10 }])
  assert.equal(result.changed, true)
  assert.equal(result.items[0].nombre, 'Ahora')
  assert.equal(result.items[0].cantidad, 2)
  assert.deepEqual(result.removed, ['Archivado'])
})
