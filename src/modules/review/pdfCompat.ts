// ---------------------------------------------------------------------------
// What pdf.js assumes the browser already has.
//
// pdf.js 6 calls `Promise.withResolvers()` about forty times, in the main
// thread and inside its worker. Safari only shipped it in 17.4, so on an
// iPhone a version or two behind, the import screen fails with "undefined is
// not a function" and no indication of what is undefined — which is how this
// was found, on a phone rather than in any check.
//
// The rest of the app runs fine on those phones, so raising a build target or
// telling a coordinator to update their phone would both be the wrong trade for
// six lines. `Object.hasOwn` is here for the same reason, one Safari version
// further back.
//
// Everything is installed only when missing, so a current browser is untouched.
// ---------------------------------------------------------------------------

/**
 * Install what pdf.js needs and this browser lacks.
 *
 * Called before pdf.js is imported, not at module load: the polyfill has to be
 * in place before the library's own top-level code runs, and it only needs to
 * exist on a screen that reads a PDF.
 */
export function installPdfCompat(): void {
  const P = Promise as PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>
      resolve: (value: T | PromiseLike<T>) => void
      reject: (reason?: unknown) => void
    }
  }
  if (typeof P.withResolvers !== 'function') {
    P.withResolvers = function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      // The executor runs synchronously, so both are assigned by the time this
      // returns — which is the whole contract callers rely on.
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }
  }

  const O = Object as ObjectConstructor & {
    hasOwn?: (target: object, key: PropertyKey) => boolean
  }
  if (typeof O.hasOwn !== 'function') {
    O.hasOwn = (target: object, key: PropertyKey) =>
      Object.prototype.hasOwnProperty.call(target, key)
  }
}

/** True when this browser needed the shim — i.e. pdf.js's worker will too. */
export function needsPdfCompat(): boolean {
  return typeof (Promise as { withResolvers?: unknown }).withResolvers !== 'function'
}

/**
 * A worker URL that carries the shim with it.
 *
 * A Web Worker is its own global scope, so patching Promise here does nothing
 * for the half of pdf.js that runs over there — and that half calls
 * `withResolvers` too. So on a browser that needs it, the worker is started
 * from a tiny module that installs the shim and then imports the real worker.
 *
 * The import specifier has to be absolute: a blob URL has no path for a
 * relative one to resolve against.
 *
 * Returns undefined when the browser needs no help, which is the common case
 * and leaves the ordinary worker path completely untouched.
 */
export function shimmedWorkerUrl(realWorkerUrl: string): string | undefined {
  if (!needsPdfCompat()) return undefined
  const absolute = new URL(realWorkerUrl, window.location.href).href
  const source = `
${installPdfCompat.toString()}
installPdfCompat();
await import(${JSON.stringify(absolute)});
`
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
}

/**
 * What a file actually is, when it is not a PDF.
 *
 * Checked before pdf.js is handed the bytes, because pdf.js answers every one
 * of these with "Invalid PDF structure" — which reads as "your export is
 * broken" when the truth is usually that the wrong file was picked. A name
 * ending in .pdf proves nothing: a browser that printed a page to HTML, a
 * downloaded zip and a phone photo of a chart all get renamed by hand.
 *
 * Returns undefined for a real PDF, which is the only case that continues.
 */
export function sniffFile(bytes: Uint8Array): string | undefined {
  // Sixteen, not eight: "<!DOCTYPE html" is fourteen characters and an eight
  // byte window cut it in half, so a saved web page fell through to the
  // generic answer.
  const head = Array.from(bytes.subarray(0, 16), (b) => String.fromCharCode(b)).join('')
  if (head.startsWith('%PDF-')) return undefined
  if (bytes.length === 0) return 'The file is empty.'
  if (head.startsWith('PK\u0003\u0004')) {
    return 'This is a zip or an Office file (.docx, .xlsx), not a PDF, whatever the name says.'
  }
  if (/^\s*<(!doctype|html)/i.test(head)) {
    return 'This is an HTML page, not a PDF. A report saved with "Save page as" rather than printed to PDF comes out like this.'
  }
  if (head.startsWith('\u0089PNG') || head.startsWith('\u00ff\u00d8\u00ff')) {
    return 'This is an image, not a PDF.'
  }
  if (head.startsWith('{') || head.startsWith('[')) return 'This is a JSON file, not a PDF.'
  return 'This file does not start like a PDF, whatever its name says. Print the report to PDF from Elite rather than saving the page.'
}

/**
 * A reading failure explained in terms someone can act on.
 *
 * "undefined is not a function" on a phone is not a fixable report, and
 * neither is "Invalid PDF structure". Each branch names the thing to go and
 * do, and leaves the original message attached for whoever reads the code.
 */
export function describePdfFailure(err: unknown): string {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as Error).name) : ''
  const message = err instanceof Error ? err.message : String(err)
  if (name === 'PasswordException' || /password/i.test(message)) {
    return 'The PDF is password protected. Export it again without a password, or open it and re-save a copy.'
  }
  // The reader itself failed to load, which is not a problem with the file at
  // all. pdf.js is 2 MB and is fetched the first time a PDF is opened, so this
  // is what being offline on a device that has never imported one looks like.
  if (/fake worker|dynamically imported module|Failed to fetch|NetworkError|importScripts/i.test(message)) {
    return 'The app could not load its PDF reader. Open this screen once while online — the reader is 2 MB and is fetched the first time you import — then it works offline.'
  }
  if (/undefined is not a function|is not a function|not defined/i.test(message)) {
    return `${message} — this usually means the browser is too old to read PDFs. `
      + 'Try a current Safari or Chrome, or a desktop.'
  }
  if (/Invalid PDF|corrupt|startxref|XRef/i.test(message)) {
    return 'The PDF is damaged or was only partly downloaded. Download the export again and check it opens in a PDF reader first.'
  }
  return message
}
