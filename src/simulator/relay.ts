// ---------------------------------------------------------------------------
// Cross-device relay for the simulator.
//
// The two windows have always talked over a BroadcastChannel with localStorage
// as the fallback. Both are same-origin *and same browser*: they work when the
// panel and the monitor are two windows on one machine, and they cannot work
// at all when the monitor is on an iPad across the room and the facilitator is
// on a laptop. Nothing about that arrangement was broken — it was never wired.
//
// This adds a third path over the Supabase project CES already carries, using
// Realtime broadcast rather than the database: the state a scenario is in is
// worth nothing once the scenario is over, and writing a row per slider drag
// would be absurd. Nothing is persisted.
//
// It is additive. The BroadcastChannel path stays exactly as it was, so two
// windows on one laptop keep working with no session and no network, and a
// dropped connection degrades to that rather than to nothing.
//
// Built as its own entry with a stable filename so the two static pages under
// public/simulator/ can load it without a bundler of their own.
// ---------------------------------------------------------------------------
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_CLOUD } from '../config/cloud'

const CONFIG_KEY = 'ces.cloud.config'

/** Whatever project this device is pointed at — the same lookup sync.ts does. */
function cloudConfig(): { url: string; anonKey: string } | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fall through to the built-in project
  }
  return DEFAULT_CLOUD.url ? DEFAULT_CLOUD : null
}

export type RelayStatus = 'off' | 'joining' | 'live' | 'error'

export interface Relay {
  /** Publish patient state to everything joined to this session. */
  send(payload: unknown): void
  /** Publish a monitor-side message: a heartbeat or a device event. */
  sendBack(payload: unknown): void
  leave(): void
  status(): RelayStatus
  code(): string
}

/**
 * Session codes are typed on an iPad by someone standing up, so the alphabet
 * drops the characters that get misread on a projector or a small screen —
 * no O/0, no I/1/L, no 5/S, no 8/B.
 */
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY234679'
export function newSessionCode(): string {
  let out = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function normaliseCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

interface JoinOptions {
  code: string
  /** 'panel' publishes state; 'monitor' publishes heartbeats and device events. */
  role: 'panel' | 'monitor'
  onState?: (payload: unknown) => void
  onBack?: (payload: unknown) => void
  onStatus?: (status: RelayStatus, detail?: string) => void
}

let client: SupabaseClient | null = null
let channel: RealtimeChannel | null = null
let current: RelayStatus = 'off'
let currentCode = ''

export function joinSession(opts: JoinOptions): Relay {
  leaveSession()
  const cfg = cloudConfig()
  const setStatus = (s: RelayStatus, detail?: string) => {
    current = s
    opts.onStatus?.(s, detail)
  }
  currentCode = normaliseCode(opts.code)

  if (!cfg || currentCode.length !== 6) {
    setStatus('error', !cfg ? 'No cloud project configured' : 'Session code must be six characters')
    return relayHandle()
  }

  setStatus('joining')
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // One message per animation-frame-ish is far more than a slider produces,
    // and well under the project's default limit.
    realtime: { params: { eventsPerSecond: 20 } },
  })

  channel = client.channel(`ces-sim-${currentCode}`, {
    config: { broadcast: { self: false, ack: false } },
  })
  channel
    .on('broadcast', { event: 'state' }, (m) => {
      if (opts.role === 'monitor') opts.onState?.((m as { payload?: unknown }).payload)
    })
    .on('broadcast', { event: 'back' }, (m) => {
      if (opts.role === 'panel') opts.onBack?.((m as { payload?: unknown }).payload)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') setStatus('live')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setStatus('error', status)
      else if (status === 'CLOSED') setStatus('off')
    })

  return relayHandle()
}

function relayHandle(): Relay {
  return {
    send(payload) {
      if (current !== 'live' || !channel) return
      void channel.send({ type: 'broadcast', event: 'state', payload })
    },
    sendBack(payload) {
      if (current !== 'live' || !channel) return
      void channel.send({ type: 'broadcast', event: 'back', payload })
    },
    leave: leaveSession,
    status: () => current,
    code: () => currentCode,
  }
}

export function leaveSession(): void {
  try {
    channel?.unsubscribe()
  } catch {
    // already gone
  }
  channel = null
  client = null
  current = 'off'
  currentCode = ''
}

// The static pages have no module system of their own, so the entry hangs its
// surface on window rather than exporting into a void.
declare global {
  interface Window {
    CESRelay: {
      joinSession: typeof joinSession
      leaveSession: typeof leaveSession
      newSessionCode: typeof newSessionCode
      normaliseCode: typeof normaliseCode
    }
  }
}
window.CESRelay = { joinSession, leaveSession, newSessionCode, normaliseCode }
