import { create } from 'zustand'
import type { SelectedEntry } from './useSelectionStore'


interface ActiveExport {
  exportId: string
  topicId: string
  entries: SelectedEntry[]
}


interface ExportState {
  active: ActiveExport | null
  setActive: (task: ActiveExport) => void
  clear: () => void
}


export const useExportStore = create<ExportState>((set) => ({
  active: null,
  setActive: (active) => set({ active }),
  clear: () => set({ active: null }),
}))
