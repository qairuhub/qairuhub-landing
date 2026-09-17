/**
 * Keeps React alive when a browser translator rewrites the page.
 *
 * Chrome's built-in Google Translate (seen on a Russian-language Mac) replaces every text node it
 * translates with `<font>` wrappers. React still holds the original text nodes, so the next update
 * that removes or re-inserts one (a menu closing, the EN/KK switch, the carousel, the assistant)
 * calls `removeChild` / `insertBefore` with a node whose parent is no longer the one React expects,
 * the DOM throws `NotFoundError`, and React unmounts the whole tree: a blank page.
 *
 * The guard below is the widely used mitigation from facebook/react#11538: when the node is not
 * where React thinks it is, skip the operation instead of throwing. On an untranslated page the
 * checks never fail, so behaviour is unchanged. Install once, before the first render.
 */
export function installDomGuard(): void {
  if (typeof Node !== 'function' || !Node.prototype) return
  const proto = Node.prototype as Node & { __qhDomGuard?: true }
  if (proto.__qhDomGuard) return
  proto.__qhDomGuard = true

  const removeChild = proto.removeChild
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      if (import.meta.env.DEV) console.warn('[domGuard] removeChild skipped: the node was moved (page translation?)', child)
      return child
    }
    return removeChild.call(this, child) as T
  }

  const insertBefore = proto.insertBefore
  proto.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) {
      if (import.meta.env.DEV) console.warn('[domGuard] insertBefore skipped: the reference node was moved (page translation?)', reference)
      return node
    }
    return insertBefore.call(this, node, reference) as T
  }
}
