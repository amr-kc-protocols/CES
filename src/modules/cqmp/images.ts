import { activeMarket, type Market } from '../../lib/market'
import { uid } from '../../lib/id'
import type { CqmpImageRef } from '../../types'

// ---------------------------------------------------------------------------
// Screenshot storage for the CQMP deck.
//
// Dashboard screenshots are the one thing in this app that is genuinely large:
// a phone photo or a full-screen capture is 2–8 MB, and a month's report holds
// up to twelve of them. Three places they must NOT go:
//
//   localStorage — the store serialises the entire database on every keystroke
//   and the whole quota is about 5 MB. One month of screenshots would fill it
//   and take every cohort, roster and evaluation down with it.
//
//   the `records` table — sync mirrors every record to every admin device.
//
//   the HTTP cache — they never leave the device at all.
//
// So they live in their own IndexedDB database, keyed by an id the report
// record holds. Everything here is best-effort: a browser with IndexedDB
// blocked (private mode in some builds) still gets a working report screen and
// a deck without images, which is why every read resolves to undefined rather
// than throwing.
//
// Images are downscaled on the way in. A 4032×3024 phone photo carries no more
// readable detail on a projector than a 1600px-wide JPEG, and the JPEG is a
// twentieth of the size.
// ---------------------------------------------------------------------------

const DB_NAME = 'ces-cqmp-images'
const DB_VERSION = 1
const STORE = 'images'

/** Long edge after downscaling. Keeps axis labels legible when projected. */
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

interface StoredImage {
  key: string
  /** Which market's deck this belongs to — the sweep is per market. */
  market: Market
  name: string
  blob: Blob
  addedAt: string
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' }).createIndex('market', 'market')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined)
        try {
          const t = db.transaction(STORE, mode)
          const req = run(t.objectStore(STORE))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(undefined)
          t.onabort = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      }),
  )
}

// ----- import --------------------------------------------------------------

interface Decoded {
  blob: Blob
  width: number
  height: number
}

/**
 * Decode, downscale and re-encode as JPEG.
 *
 * `createImageBitmap` is the fast path and handles EXIF orientation on every
 * browser this app supports; the <img> fallback is there for older Safari,
 * which is the browser most likely to be handed a screenshot from a phone.
 */
async function downscale(file: Blob): Promise<Decoded> {
  const source = await decode(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height))
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')
  // Screenshots are line art on white; a flattened white ground keeps any
  // transparency from turning black in the JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source.image, 0, 0, width, height)
  source.release()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('The image could not be converted.')
  return { blob, width, height }
}

interface DecodedSource {
  image: CanvasImageSource
  width: number
  height: number
  /** Called once the pixels have been drawn — frees the bitmap or object URL. */
  release: () => void
}

async function decode(file: Blob): Promise<DecodedSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Fall through — some builds refuse formats the <img> tag still decodes.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That file could not be read as an image.'))
      el.src = url
    })
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/**
 * Take a file (picker, drop or paste), downscale it, store it, and hand back
 * the reference the report record keeps. Throws with a message fit to show.
 */
export async function addScreenshot(file: File | Blob, fallbackName = 'screenshot'): Promise<CqmpImageRef> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('That file is not an image. Screenshots should be PNG or JPEG.')
  }
  const { blob, width, height } = await downscale(file)
  const name = 'name' in file && file.name ? file.name : `${fallbackName}.jpg`
  const key = uid('cqmpimg')
  const record: StoredImage = {
    key,
    market: activeMarket(),
    name,
    blob,
    addedAt: new Date().toISOString(),
  }
  const ok = await tx('readwrite', (s) => s.put(record) as IDBRequest<IDBValidKey>)
  if (ok === undefined) {
    throw new Error('This browser would not store the screenshot (private mode or no space).')
  }
  return { key, name, width, height, size: blob.size, addedAt: record.addedAt }
}

// ----- read ----------------------------------------------------------------

export async function getScreenshotBlob(key: string): Promise<Blob | undefined> {
  const rec = await tx<StoredImage>('readonly', (s) => s.get(key) as IDBRequest<StoredImage>)
  return rec?.blob
}

/** Object URL for on-screen thumbnails. Callers must revoke it. */
export async function getScreenshotUrl(key: string): Promise<string | undefined> {
  const blob = await getScreenshotBlob(key)
  return blob ? URL.createObjectURL(blob) : undefined
}

/** Base64 data URL — what pptxgenjs embeds. Undefined when the image is gone. */
export async function getScreenshotDataUrl(key: string): Promise<string | undefined> {
  const blob = await getScreenshotBlob(key)
  if (!blob) return undefined
  return new Promise<string | undefined>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(blob)
  })
}

// ----- delete --------------------------------------------------------------

export async function deleteScreenshot(key: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>)
}

/**
 * Drop every image this market holds that no report references any more.
 *
 * Deleting a report does NOT delete its screenshots, because the delete is
 * undoable for ten seconds and an undo that restores a report with twelve
 * broken images is not an undo. The orphans are collected here instead, on the
 * next visit to the CQMP list — by which time any undo has long expired.
 */
export async function purgeOrphanScreenshots(keepKeys: Set<string>): Promise<number> {
  const db = await openDB()
  if (!db) return 0
  const market = activeMarket()
  return new Promise<number>((resolve) => {
    let removed = 0
    try {
      const t = db.transaction(STORE, 'readwrite')
      const store = t.objectStore(STORE)
      const cursorReq = store.index('market').openCursor(IDBKeyRange.only(market))
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) return
        const rec = cursor.value as StoredImage
        if (!keepKeys.has(rec.key)) {
          cursor.delete()
          removed++
        }
        cursor.continue()
      }
      t.oncomplete = () => resolve(removed)
      t.onerror = () => resolve(removed)
      t.onabort = () => resolve(removed)
    } catch {
      resolve(0)
    }
  })
}
