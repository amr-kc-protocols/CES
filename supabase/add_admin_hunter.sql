-- ---------------------------------------------------------------------------
-- Full access: hunter04j@hotmail.com — administrator, every operation.
--
-- "Everything" in this app is two settings on one profile row:
--
--   role   = 'admin'  Every screen that is gated is gated on this: NEOP
--                     setup and cohorts, releases, the AEMT program and its
--                     certification records, selection-exam results, chart
--                     review, sheets & forms, and the CQMP deck.
--   market = 'all'    Kansas City, Wichita, Independence and Topeka, with the
--                     operation switcher in the app header. A single-market
--                     admin sees only their own operation's records — the
--                     database enforces that, not the app.
--
-- Granted by a named, reviewable file rather than an edit in the Table Editor,
-- for the same reason as add_admin_mary_glover.sql: it is the widest access
-- there is, and who granted it should not depend on someone remembering.
--
-- Note this is a personal address, not a gmr.net one. An admin reads AEMT
-- certification records and applicants' exam answers, and an account outside
-- the corporate domain is outside its password and offboarding policy.
--
-- Safe to re-run. It never duplicates an account and never resets a password.
--
-- TWO WAYS IN, and the file handles both:
--
--   1. The account already exists (signed in at least once, by password or
--      by emailed code). Run this as it stands; it promotes the account.
--
--   2. No account yet. Either have them sign in once (app → Settings →
--      Cloud sync → "Email me a sign-in code") and re-run this unchanged, or
--      set v_password below and run it — that creates the account, confirms
--      the address and promotes it in one pass. Leave v_password alone and
--      the file stops with an explanation rather than inventing a credential:
--      a password committed to a repository is a published one.
--
-- Operations 'independence' and 'topeka' need
-- migrations/2026-10-01-four-operations.sql first. 'all' works without it,
-- but the switcher will only reach Independence and Topeka once it has run.
-- ---------------------------------------------------------------------------

do $$
declare
  v_email    constant text := 'hunter04j@hotmail.com';
  v_market   constant text := 'all';
  -- Only needed if the account does not exist yet.
  v_password constant text := 'SET-A-STARTING-PASSWORD-HERE';
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(v_email);

  if uid is null then
    -- Both conditions, not just the placeholder: a find-and-replace across the
    -- file changes this line as well as the declaration.
    if v_password = 'SET-A-STARTING-PASSWORD-HERE' or length(v_password) < 6 then
      raise exception
        'No account exists for % yet. Either have them sign in once (app → '
        'Settings → Cloud sync → "Email me a sign-in code") and re-run this '
        'file unchanged, or set v_password at the top of this file and run it '
        'again. Nothing has been changed.', v_email;
    end if;

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}'::jsonb,
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', v_email),
      'email', now(), now(), now()
    );
  end if;

  -- The signup trigger creates a profile defaulting to newhire/kc; this is what
  -- actually grants the access. An existing account keeps its password.
  insert into public.profiles (user_id, email, role, market)
    values (uid, v_email, 'admin', v_market)
  on conflict (user_id) do update
    set role = 'admin', market = v_market, email = excluded.email;
end $$;

-- Confirm: one row, admin / all, with a usable sign-in.
select p.email, p.role, p.market,
       (u.encrypted_password is not null) as has_password,
       (u.email_confirmed_at is not null) as confirmed
from public.profiles p
join auth.users u on u.id = p.user_id
where lower(p.email) = 'hunter04j@hotmail.com';

-- ---------------------------------------------------------------------------
-- Revert (keep the account, remove the access):
--   update public.profiles set role = 'newhire', market = 'kc'
--   where lower(email) = 'hunter04j@hotmail.com';
-- ---------------------------------------------------------------------------
