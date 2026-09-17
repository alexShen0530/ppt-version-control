import { create } from 'zustand'

interface UploadState {
  ids: string[]
  add: (id: string) => void
}

export const useUploadStore = create<UploadState>((set) => ({
  ids: [],
  add: (id) => set((state) => ({
    ids: state.ids.includes(id) ? state.ids : [id, ...state.ids],
  })),
}))
