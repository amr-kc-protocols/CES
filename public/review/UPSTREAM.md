# EMS Transport Review — vendored copy

This directory is the standalone **EMS Transport Review** app, dropped in
whole and served as static files. It is not built by Vite: everything under
`public/` is copied to `dist/` verbatim, so these are the same files the
browser runs.

It renders inside an iframe at `/review`, behind an admin-only route guard
(`src/modules/review/ReviewView.tsx`).

## Why it is vendored rather than ported to React

The parsing and criteria logic was validated against 13 real ImageTrend charts
with a hand-built ground truth. A port to TypeScript components would put that
validation in question for no functional gain — the app owns its own DOM, its
own IndexedDB and its own state, and shares nothing with the CES store.

The privacy posture is the other reason. The app's guarantee is that it has no
network code path at all. Verified on this copy:

```
$ grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|sendBeacon" js/
(no matches)
```

Keeping it out of the React bundle keeps that property checkable with one
command, rather than something you have to reason about against a module graph
that includes the Supabase client.

## Changes from the upstream drop

Five. Re-apply them when new files arrive — number 4 especially, since it is a
real bug rather than an integration concession.

1. **`index.html`** — removed `<link rel="manifest">` and the two icon links.
   The host PWA supplies the manifest, icons and theme for the whole origin;
   a second manifest would compete with it. Icon links are inert in an iframe.

2. **`js/app.js`** — removed the `navigator.serviceWorker.register('sw.js')`
   call at the end of `init()`. Two service workers on one origin fight over
   scope. Caching is handled by the host's Workbox service worker instead
   (see below), so offline behaviour is unchanged.

3. **`sw.js` and `manifest.webmanifest` are not copied in.** They are the two
   files that exist only to make the app standalone-installable, which is the
   host PWA's job here.

4. **`css/styles.css`** — added `[hidden] { display: none !important; }` at the
   top. This one is a bug fix, and it applies to the standalone app too.

   `[hidden] { display: none }` is a *user-agent* rule, and any author rule that
   sets `display` overrides it — specificity is not the deciding factor, origin
   is. Three elements declare one: `.stats` (grid), `.toolbar` (flex) and
   `.drawer` (flex). So none of the three could ever be hidden:

   - the stats row and toolbar rendered on an empty app, before any chart existed
   - the drawer sat permanently over the right `min(760px, 96vw)` of the
     viewport as an empty "Incident" panel, intercepting clicks on **Thresholds,
     Print sheets and Export XLSX**

   `js/app.js` was right the whole way through — it sets `.hidden` correctly in
   `render()`, `openDrawer()` and `closeDrawer()`. Only the CSS ignored it.

   Reproduced against the app served standalone at `/review/index.html` with no
   host chrome, so it is upstream and not an artefact of embedding. Worth fixing
   in the source tree the drops come from.

5. **`css/styles.css`** — `--navy` changed from `#1f3864` to `#20395a`, the
   host app's masthead navy. The tool renders directly under that masthead, and
   two navies a few degrees apart stacked on top of each other read as a
   rendering fault rather than as two applications. Cosmetic only.

Everything else — `js/parser.js`, `js/criteria.js`, `js/store.js`,
`js/exporter.js`, `lib/*` — is byte-identical to upstream.

## Updating

Drop the new files in, then re-apply changes 1 and 2 above and re-run the grep.
`js/criteria.js` is the file to route to a clinician for review; nothing in this
integration touches it.

## Caching

The host service worker precaches the CES app shell for every user. This
directory is **excluded** from that precache (`globIgnores` in `vite.config.ts`)
and cached at runtime instead, on first use.

That split is deliberate. `lib/` alone is 2.2 MB — pdf.js plus SheetJS. Every
new hire and FTO carries the precache; only admins can open this tab. Runtime
caching gives admins the same offline behaviour they had standalone, and costs
everyone else nothing.

## Storage

IndexedDB database `ems-transport-review`, object stores `charts` and
`settings`. It is not in `src/lib/records.ts` `SLICES` and therefore **does not
sync to Supabase** — chart PHI stays on the device, which is the whole design.
"Clear all data" in the app's toolbar empties it.
