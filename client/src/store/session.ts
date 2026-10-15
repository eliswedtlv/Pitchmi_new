/**
 * Session store — lightweight Zustand store for cross-screen state.
 * Keeps only what needs to be shared between screens.
 */

import { create } from "zustand"
import type { Project, PathResult } from "@/lib/api"

/**
 * What the last take did to the rhythm (KP-B):
 *  - "new": the take matched the script and became the rhythm
 *  - "unchanged": it didn't match closely, the previous rhythm (if any) stays
 *  - "locked": the rhythm is locked, so the take was never uploaded
 *  - "failed": the rhythm step errored; the take is still kept and shareable
 */
export type TakeRhythm = "new" | "unchanged" | "locked" | "failed"

interface SessionState {
  project: Project | null
  // The typed script (T-10018), kept so "Edit text" on the results screen can
  // pre-fill the home textarea with what the user actually wrote. It is also
  // what the take-1 teleprompter shows.
  script: string
  takeBlob: Blob | null
  takeBlobUrl: string | null
  /** The current rhythm. Null until a take matches the script: teleprompter mode. */
  pathResult: PathResult | null
  /** "Keep this rhythm": next takes follow pathResult and skip the upload. */
  rhythmLocked: boolean
  takeRhythm: TakeRhythm | null

  setProject: (p: Project) => void
  setScript: (text: string) => void
  setTakeBlob: (blob: Blob | null) => void
  setPathResult: (r: PathResult | null) => void
  setRhythmLocked: (locked: boolean) => void
  setTakeRhythm: (r: TakeRhythm | null) => void
  reset: () => void
}

export const useSession = create<SessionState>((set, get) => ({
  project: null,
  script: "",
  takeBlob: null,
  takeBlobUrl: null,
  pathResult: null,
  rhythmLocked: false,
  takeRhythm: null,

  setProject: (project) => set({ project }),
  setScript: (script) => set({ script }),

  setTakeBlob: (blob) => {
    const prev = get().takeBlobUrl
    if (prev) URL.revokeObjectURL(prev)
    if (!blob) {
      set({ takeBlob: null, takeBlobUrl: null })
      return
    }
    const url = URL.createObjectURL(blob)
    set({ takeBlob: blob, takeBlobUrl: url })
  },

  setPathResult: (pathResult) => set({ pathResult }),
  setRhythmLocked: (rhythmLocked) => set({ rhythmLocked }),
  setTakeRhythm: (takeRhythm) => set({ takeRhythm }),

  reset: () => {
    const prev = get().takeBlobUrl
    if (prev) URL.revokeObjectURL(prev)
    set({
      project: null,
      script: "",
      takeBlob: null,
      takeBlobUrl: null,
      pathResult: null,
      rhythmLocked: false,
      takeRhythm: null,
    })
  },
}))
