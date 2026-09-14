/**
 * Shared, lerped mouse position in normalised device coords (-1..1, y up).
 * Written by a window listener, smoothed once per frame by `stepPointer`, read inside
 * useFrame loops (never via React state).
 */
export const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

export function attachPointer(): () => void {
  const onMove = (e: MouseEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1)
  }
  const onLeave = () => {
    pointer.tx = 0
    pointer.ty = 0
  }
  window.addEventListener('mousemove', onMove, { passive: true })
  document.addEventListener('mouseleave', onLeave)
  return () => {
    window.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseleave', onLeave)
    pointer.x = pointer.y = pointer.tx = pointer.ty = 0
  }
}

export function stepPointer(k: number) {
  pointer.x += (pointer.tx - pointer.x) * k
  pointer.y += (pointer.ty - pointer.y) * k
}
