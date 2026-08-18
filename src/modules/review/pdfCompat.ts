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
 * A reading failure explained in terms someone can act on.
 *
 * "undefined is not a function" on a phone is not a fixable report. Naming the
 * browser as the likely cause turns it into one, and leaves the original
 * message attached for whoever ends up reading the code.
 */
export function describePdfFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/undefined is not a function|is not a function|not defined/i.test(message)) {
    return `${message} — this usually means the browser is too old to read PDFs. `
      + 'Try a current Safari or Chrome, or a desktop.'
  }
  if (/password/i.test(message)) return 'The PDF is password protected.'
  if (/Invalid PDF|corrupt/i.test(message)) return 'The file is not a readable PDF.'
  return message
}
