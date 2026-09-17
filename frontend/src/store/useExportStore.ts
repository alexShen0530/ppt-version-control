import { create } from 'zustand'
import type { SelectedEntry } from './useSelectionStore'


export interface ActiveExport {
  exportId: string
  topicId: string
  entries: SelectedEntry[]
}


interface ExportState {
  tasks: ActiveExport[]
  viewedId: string | null
  add: (task: ActiveExport) => void
  view: (exportId: string | null) => void
  dismiss: (exportId: string) => void
}


export const useExportStore = create<ExportState>((set) => ({
  tasks: [],
  viewedId: null,
  add: (task) => set((state) => ({ tasks: [task, ...state.tasks], viewedId: task.exportId })),
  view: (viewedId) => set({ viewedId }),
  dismiss: (exportId) => set((state) => ({
    tasks: state.tasks.filter((task) => task.exportId !== exportId),
    viewedId: state.viewedId === exportId ? null : state.viewedId,
  })),
}))
