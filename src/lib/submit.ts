/**
 * Submission seam for the two forms on the page (Join form + Accelerator waitlist).
 *
 * Components only ever call `submitJoin` / `subscribeWaitlist`; they never talk to the
 * network themselves. To integrate a real backend, replace the bodies below (e.g. with a
 * `fetch` POST) and keep the signatures — nothing else on the page needs to change.
 *
 * Both functions:
 *  - resolve on success and reject on failure (callers show an error state on rejection),
 *  - accept an optional `AbortSignal` so a caller can cancel an in-flight request on
 *    unmount / reset (reject with a DOMException named "AbortError", like `fetch` does).
 */

/** Fields of the "Join QairuHub" form (see `form.fields` in content.ts). */
export type JoinFieldKey = 'firstName' | 'lastName' | 'email' | 'telegram' | 'year' | 'source' | 'message'
export type JoinValues = Record<JoinFieldKey, string>

export interface SubmitOptions {
  signal?: AbortSignal
}

/** Placeholder latency so the UI's "sending" state is visible until a backend exists. */
const FAKE_SUBMIT_MS = 600

function abortError(): DOMException {
  return new DOMException('The submission was aborted.', 'AbortError')
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Resolves after `ms`, or rejects immediately/early when `signal` aborts. */
function fakeRequest(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(abortError())
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Submit the Join form. Replace the body with a real request, e.g.
 *
 *   const res = await fetch('/api/join', { method: 'POST', body: JSON.stringify(values), signal })
 *   if (!res.ok) throw new Error(`Join failed: ${res.status}`)
 */
export async function submitJoin(values: JoinValues, { signal }: SubmitOptions = {}): Promise<void> {
  void values
  await fakeRequest(FAKE_SUBMIT_MS, signal)
}

/**
 * Subscribe an email to the Accelerator waitlist. Replace the body with a real request, e.g.
 *
 *   const res = await fetch('/api/waitlist', { method: 'POST', body: JSON.stringify({ email }), signal })
 *   if (!res.ok) throw new Error(`Waitlist failed: ${res.status}`)
 */
export async function subscribeWaitlist(email: string, { signal }: SubmitOptions = {}): Promise<void> {
  void email
  await fakeRequest(FAKE_SUBMIT_MS, signal)
}
