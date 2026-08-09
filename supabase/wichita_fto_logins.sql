-- ---------------------------------------------------------------------------
-- Wichita FTO logins.
--
-- Same pattern as the existing accounts: the username is the work email and
-- the password is the employee number. Email is marked confirmed so they sign
-- in with a password immediately rather than waiting on a verification mail
-- that corporate scanners tend to consume.
--
-- Safe to re-run. An account that already exists has its password reset and
-- its profile corrected; it is never duplicated.
--
--   Alex Thomas      alex.thomas@gmr.net      26020634   paramedic
--   Alex White       alex.white@gmr.net       26082380   EMT
--   Sarah Lamm       sarah.lamm@gmr.net       26047607   paramedic
--   Nathan Huyett    nathan.huyett@gmr.net    26027184   AEMT
--   Jordan Riddall   jordan.riddall@gmr.net   26040453   AEMT
-- ---------------------------------------------------------------------------

do $$
declare
  r   record;
  uid uuid;
begin
  for r in
    select * from (values
      ('alex.thomas@gmr.net',    '26020634', 'Alex Thomas'),
      ('alex.white@gmr.net',     '26082380', 'Alex White'),
      ('sarah.lamm@gmr.net',     '26047607', 'Sarah Lamm'),
      ('nathan.huyett@gmr.net',  '26027184', 'Nathan Huyett'),
      ('jordan.riddall@gmr.net', '26040453', 'Jordan Riddall')
    ) as t(email, employee_id, full_name)
  loop
    select id into uid from auth.users where email = r.email;

    if uid is null then
      uid := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', r.email,
        crypt(r.employee_id, gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', r.full_name, 'employee_id', r.employee_id),
        '', '', '', ''
      );

      insert into auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        uid::text, uid,
        jsonb_build_object('sub', uid::text, 'email', r.email),
        'email', now(), now(), now()
      );
    else
      update auth.users
         set encrypted_password = crypt(r.employee_id, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = uid;
    end if;

    -- The signup trigger creates a profile defaulting to newhire/kc; this is
    -- what actually makes them a Wichita FTO.
    insert into public.profiles (user_id, email, role, market)
      values (uid, r.email, 'fto', 'wichita')
    on conflict (user_id) do update
      set role = 'fto', market = 'wichita', email = excluded.email;
  end loop;
end $$;

-- Confirm: five rows, each fto / wichita, all with a password and confirmed.
select p.email, p.role, p.market,
       (u.encrypted_password is not null) as has_password,
       (u.email_confirmed_at is not null) as confirmed
from public.profiles p
join auth.users u on u.id = p.user_id
where p.email in (
  'alex.thomas@gmr.net','alex.white@gmr.net','sarah.lamm@gmr.net',
  'nathan.huyett@gmr.net','jordan.riddall@gmr.net'
)
order by p.email;
