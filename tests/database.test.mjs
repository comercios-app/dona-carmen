import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('Postgres: permisos, historial, conflictos, validación y guardado atómico', async () => {
  const db = new PGlite()
  const admin = '00000000-0000-0000-0000-000000000001'
  const other = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      grant usage on schema public to anon, authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${admin}', 'gaston3x@gmail.com'), ('${other}', 'other@example.com');
    `)
    const sql = async (file) => readFile(new URL('../supabase/' + file, import.meta.url), 'utf8')
    await db.exec(await sql('01-schema.sql'))
    await db.exec(await sql('02-prices.sql'))
    await db.exec(await sql('03-admin.sql'))
    // Scripts reejecutables sin pérdida de datos.
    await db.exec(await sql('01-schema.sql'))
    await db.exec('set role anon')
    assert.equal((await db.query('select * from public.product_prices')).rows.length, 41)
    await assert.rejects(db.exec('update public.product_prices set price = 1'), /permission denied/)
    await assert.rejects(db.exec('select * from public.price_history'), /permission denied/)
    await assert.rejects(db.exec(`select public.save_prices('[]')`), /permission denied/)
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other])
    assert.equal((await db.query('select public.is_price_admin() as allowed')).rows[0].allowed, false)
    assert.equal((await db.query('select * from public.price_history')).rows.length, 0)
    await assert.rejects(db.exec(`select public.save_prices('[]')`), /NOT_ADMIN/)
    await assert.rejects(db.exec(`insert into private.price_admins values ('${other}')`), /permission denied/)
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin])
    assert.equal((await db.query('select public.is_price_admin() as allowed')).rows[0].allowed, true)
    await assert.rejects(db.exec('update public.product_prices set price = 1'), /permission denied/)
    const save = (changes) => db.query('select public.save_prices($1::jsonb)', [JSON.stringify(changes)])
    await save([{ id: 3, price: 26000, expected_version: 1 }])
    const history = (await db.query('select * from public.price_history')).rows
    assert.equal(history.length, 1)
    assert.equal(history[0].old_price, 25000)
    assert.equal(history[0].new_price, 26000)
    assert.equal(history[0].changed_by, admin)
    await assert.rejects(save([{ id: 3, price: 27000, expected_version: 1 }]), /PRICE_CONFLICT/)
    // Primera fila válida y segunda en conflicto: ninguna debe persistir.
    await assert.rejects(save([{ id: 1, price: 13000, expected_version: 1 }, { id: 3, price: 27000, expected_version: 1 }]), /PRICE_CONFLICT/)
    assert.equal((await db.query('select price from public.product_prices where id = 1')).rows[0].price, 12000)
    for (const price of [0, -1, 2.5, '25000', null, 10000001]) {
      await assert.rejects(save([{ id: 3, price, expected_version: 2 }]), /INVALID_PRICE/)
    }
    await assert.rejects(save([{ id: 3, price: 27000, expected_version: 2 }, { id: 3, price: 28000, expected_version: 2 }]), /DUPLICATE_PRODUCT/)
    assert.equal((await db.query('select * from public.price_history')).rows.length, 1)
    // Restaurar se registra como un nuevo cambio.
    await save([{ id: 3, price: 25000, expected_version: 2 }])
    assert.equal((await db.query('select version from public.product_prices where id = 3')).rows[0].version, 3)
    // Simula las tablas y permisos base que aporta Supabase Storage.
    await db.exec('reset role')
    await db.exec(`
      create schema storage;
      grant usage on schema storage to anon, authenticated;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (bucket_id text, name text, primary key(bucket_id, name));
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `)
    await db.exec(await sql('04-images.sql'))
    await db.exec(await sql('04-images.sql'))
    const first = '3/00000000-0000-0000-0000-000000000001.webp'
    const second = '3/00000000-0000-0000-0000-000000000002.webp'
    const imageSave = (path, version) => db.query('select public.save_product_image(3, $1, $2) as result', [path, version])
    await db.exec('set role anon')
    assert.equal((await db.query('select * from public.product_images')).rows.length, 41)
    await assert.rejects(imageSave(null, 1), /permission denied/)
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other])
    await assert.rejects(imageSave(null, 1), /NOT_ADMIN/)
    await assert.rejects(db.query("insert into storage.objects values ('product-images', $1)", [first]), /row-level security/)
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin])
    await assert.rejects(imageSave(first, 1), /IMAGE_NOT_UPLOADED/)
    await db.query("insert into storage.objects values ('product-images', $1), ('product-images', $2)", [first, second])
    assert.equal((await imageSave(first, 1)).rows[0].result.version, 2)
    await assert.rejects(imageSave(second, 1), /IMAGE_CONFLICT/)
    // No se puede borrar la imagen activa, ni sobrescribir su archivo.
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 1)
    assert.equal((await db.query('select name from storage.objects')).rows[0].name, first)
    assert.equal((await db.query("update storage.objects set name = 'replaced.webp' returning *")).rows.length, 0)
    await db.query("insert into storage.objects values ('product-images', $1)", [second])
    assert.equal((await imageSave(second, 2)).rows[0].result.previous_path, first)
    await assert.rejects(imageSave(first, 3), /duplicate key/)
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 1)
    assert.equal((await imageSave(null, 3)).rows[0].result.previous_path, second)
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 1)
    await db.exec('reset role')
    await db.exec(await sql('02-prices.sql'))
    assert.equal((await db.query('select version from public.product_prices where id = 3')).rows[0].version, 3)
  } finally { await db.close() }
})
