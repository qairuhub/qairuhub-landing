import { Component, type ReactNode } from 'react'

/**
 * Error boundary for a lazy island (audit A2-01). If a code-split chunk can't load (a flaky mobile
 * link, or a deploy that removed the chunk while the tab stayed open), React would otherwise
 * unmount the whole root and leave a blank page. Here only the island is replaced: by `fallback`
 * (default: nothing), and `onError` can close a panel or schedule a guarded reload
 * (`reloadOnceForChunkError`).
 *
 * It logs nothing itself. Put it outside the island's `<Suspense>`; give it a `key` (or unmount it)
 * to try the island again.
 */

export interface ChunkBoundaryProps {
  /** rendered instead of the children once they failed (default: nothing) */
  fallback?: ReactNode
  /** called once per failure */
  onError?: (error: unknown) => void
  children?: ReactNode
}

interface ChunkBoundaryState {
  failed: boolean
}

export class ChunkBoundary extends Component<ChunkBoundaryProps, ChunkBoundaryState> {
  state: ChunkBoundaryState = { failed: false }

  static getDerivedStateFromError(): ChunkBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
