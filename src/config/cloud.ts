// ---------------------------------------------------------------------------
// Built-in cloud project. Baking these in means a new user's entire setup is
// "enter your email, tap the magic link" — no keys to paste. The publishable
// key is designed to be public (row-level security is the gatekeeper), so
// committing it here is safe and intentional.
//
// A device that has explicitly configured a different project in Settings
// keeps its own config; these are only the defaults for fresh devices.
// ---------------------------------------------------------------------------

export const DEFAULT_CLOUD = {
  url: 'https://hmcklmvemggadtzbtkxc.supabase.co',
  anonKey: 'sb_publishable_TPP8KTRxbue7eEU7LkM3jw_kdSsx6tL',
}
