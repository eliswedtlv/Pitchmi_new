/**
 * Session store — lightweight Zustand store for cross-screen state.
 * Keeps only what needs to be shared between screens.
 */

import { create } from "zustand"
import type { Project, PathResult, EvalResult } from "@/lib/api"

interface SessionState {
  project: Project | null
  takeBlob: Blob | null
  takeBlobUrl: string | null
  pathResult: PathResult | null
  evalResult: EvalResult | null
  editedScript: string
  speed: number

  setProject: (p: Project) => void
  setTakeBlob: (blob: Blob | null) => void
  setPathResult: (r: PathResult | null) => void
  setEvalResult: (r: EvalResult | null) => void
  setEditedScript: (s: string) => void
  setSpeed: (speed: number) => void
  reset: () => void
}

export const useSession = create<SessionState>((set, get) => ({
  project: null,
  takeBlob: null,
  takeBlobUrl: null,
  pathResult: null,
  evalResult: null,
  editedScript: "",
  speed: 1.0,

  setProject: (project) => set({ project }),

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
  setEvalResult: (evalResult) => set({ evalResult }),
  setEditedScript: (editedScript) => set({ editedScript }),
  setSpeed: (speed) => set({ speed }),

  reset: () => {
    const prev = get().takeBlobUrl
    if (prev) URL.revokeObjectURL(prev)
    set({
      project: null,
      takeBlob: null,
      takeBlobUrl: null,
      pathResult: null,
      evalResult: null,
      editedScript: "",
      speed: 1.0,
    })
  },
}))
