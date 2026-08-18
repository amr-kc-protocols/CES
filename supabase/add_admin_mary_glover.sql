-- ---------------------------------------------------------------------------
-- Add an administrator: Mary Glover (mary.glover@gmr.net), Kansas City.
--
-- An administrator reads and writes everything in their market — NEOP cohorts
-- and evaluations, the AEMT program's certification records, exit surveys,
-- selection exam attempts and the CQMP deck. It is the widest role there is, so
-- it is granted by a named, reviewable file rather than by clicking a dropdown
-- in the Table Editor and remembering afterwards who did it.
--
-- Safe to re-run. It never duplicates an account and never downgrades one.
--
-- TWO WAYS IN, and the file handles both:
--
--   1. Mary already has an account (she has signed in at least once, by
--      password or by emailed code). Nothing else is needed — run this as it
--      stands and it promotes her to admin.
--
--   2. Mary has no account yet. Set v_password below to her employee number,
--      the same convention the existing accounts use (see
--      wichita_fto_logins.sql), and this creates the account, confirms the
--      address, and promotes it in one pass. Email is marked confirmed because
--      corporate mail scanners routinely consume the verification link before
--      anyone clicks it.
--
--      Leave v_password alone and the file stops with an explanation rather
--      than inventing a credential — a password committed to a repository is
--      not a starting password, it is a published one.
--
-- MARKET: 'kc'. Kansas City only — the same scope as every other Kansas City
-- administrator. Change v_market to 'all' if she is ever given both operations
-- (that adds the market switcher to the app header) or to 'wichita' to move her.
-- ---------------------------------------------------------------------------

do $$
declare
  v_email    constant text := 'mary.glover@gmr.net';
  v_name     constant text := 'Mary Glover';
  v_market   constant text := 'kc';
  -- Her employee number, only needed if the account does not exist yet.
  v_password constant text := 'SET-EMPLOYEE-NUMBER-HERE';
  uid uuid;
begin
  select id into uid from auth.users where email = v_email;

  if uid is null then
    -- Both conditions, not just the placeholder: a find-and-replace across the
    -- file changes the line below as well as the declaration, and the guard
    -- would then pass with whatever was typed. A length floor catches that,
    -- and catches an empty edit at the same time.
    if v_password = 'SET-EMPLOYEE-NUMBER-HERE' or length(v_password) < 6 then
      raise exception
        'No account exists for % yet. Either have her sign in once (app → '
        'Settings → Cloud sync → "Email me a sign-in code") and re-run this '
        'file unchanged, or set v_password at the top of this file to her '
        'employee number and run it again. Nothing has been changed.', v_email;
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
      jsonb_build_object('full_name', v_name),
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
  -- actually makes her an administrator. An existing account keeps its password
  -- untouched — promoting somebody is not a reason to reset their credential.
  insert into public.profiles (user_id, email, role, market)
    values (uid, v_email, 'admin', v_market)
  on conflict (user_id) do update
    set role = 'admin', market = v_market, email = excluded.email;
end $$;

-- Confirm: one row, admin / kc, with a usable sign-in.
select p.email, p.role, p.market,
       (u.encrypted_password is not null) as has_password,
       (u.email_confirmed_at is not null) as confirmed
from public.profiles p
join auth.users u on u.id = p.user_id
where p.email = 'mary.glover@gmr.net';

-- ---------------------------------------------------------------------------
-- Revert (demote, keeping the account):
--   update public.profiles set role = 'newhire' where email = 'mary.glover@gmr.net';
-- ---------------------------------------------------------------------------
