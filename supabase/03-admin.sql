-- Primero crear este usuario en Authentication > Users > Add user.
-- La contraseña se define en Supabase, nunca se pega en este archivo.
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = 'gaston3x@gmail.com';
  if admin_id is null then
    raise exception 'Primero creá gaston3x@gmail.com en Authentication > Users';
  end if;
  insert into private.price_admins (user_id) values (admin_id) on conflict do nothing;
end;
$$;
