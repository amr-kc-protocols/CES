# Cloud sync setup (Supabase)

The app is **offline-first**: your device's local data stays the working copy,
and a background sync engine shares changes through a Supabase project so
every signed-in device (you, FTOs) converges on the same data.

One-time setup, ~10 minutes:

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free tier is fine).
2. Create a project, e.g. `amr-kc-academy`. Pick a region near Kansas City (`us-east-1` works).
3. Wait for it to provision (~2 min).

## 2. Run the schema

1. In the project dashboard: **SQL Editor → New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**.
3. You should see "Success. No rows returned".

## 3. Configure auth

1. **Authentication → URL Configuration**: set **Site URL** to the deployed app URL
   (e.g. `https://your-app.vercel.app`). Magic-link emails redirect here.
2. Email sign-in (magic links) is on by default — nothing else to enable.

## 4. Connect the app

1. In the dashboard: **Settings → API Keys**. Copy the **Publishable key**
   (`sb_publishable_…`; on older projects this is the `anon` `public` JWT —
   either works). It's safe to be public — row-level security does the real
   gatekeeping. The **Project URL** is `https://<project-ref>.supabase.co`
   (shown under Settings → Data API).
2. In the app: **Settings → Cloud sync** → paste both → **Save & sign in**
   with your email → click the magic link the email contains.
3. First sign-in creates your profile with the `newhire` role. Promote
   yourself: dashboard → **Table Editor → profiles** → set your row's `role`
   to `admin`.
4. Back in the app: **Push local data to cloud** seeds the project with
   everything on your device (your existing cohort included).

## 5. Add FTOs / other devices

The project URL + publishable key are baked into the app
(`src/config/cloud.ts`), so nobody else touches keys:

- New person/device: open the app → **Settings → Cloud sync** → enter email →
  tap the magic link. Done.
- Then set their `role` in **Table Editor → profiles** (one time per person).
- Roles: `admin` writes everything · `fto` writes trainees (checklist marks,
  contacts), attendance, and ride assignments · `newhire` is read-only in v1.

## How sync behaves

- Every change writes locally first (instant, works in dead zones), then
  queues for push. The outbox flushes when the network allows.
- Pulls happen on app start, when the app returns to the foreground, and
  every couple of minutes while open.
- Conflicts resolve **last-write-wins per record** — fine at this team's
  scale, since two people rarely edit the same trainee at the same moment.
- Deletions are tombstones, so offline devices learn about them on next pull.
