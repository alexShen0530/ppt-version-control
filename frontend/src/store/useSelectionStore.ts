import { create } from 'zustand'
import type { MasterPage, RevisionVersion } from '@/types'
import { reorder } from '@/lib/utils'


export interface SelectedEntry {
  topic_id: string
  revision_group_id: string
  page_id: string
  revision_no: number
  title: string
  image_url: string
  source_file_name: string
  source_page_no: number
  created_at: string
}


interface SelectionState {
  entries: SelectedEntry[]
  toggle: (topicId: string, page: MasterPage) => void
  remove: (groupId: string) => void
  clearTopic: (topicId: string) => void
  clearAll: () => void
  move: (from: number, to: number) => void
  applyVersion: (groupId: string, version: RevisionVersion) => void
  syncLatest: (topicId: string, page: MasterPage) => void
}


function fromMaster(topicId: string, page: MasterPage): SelectedEntry {
  return {
    topic_id: topicId,
    revision_group_id: page.revision_group_id,
    page_id: page.page_id,
    revision_no: page.revision_no,
    title: page.title,
    image_url: page.image_url,
    source_file_name: page.source_file_name,
    source_page_no: page.source_page_no,
    created_at: page.created_at,
  }
}


export const useSelectionStore = create<SelectionState>((set) => ({
  entries: [],

  toggle: (topicId, page) => set((state) => ({
    entries: state.entries.some((entry) => entry.revision_group_id === page.revision_group_id)
      ? state.entries.filter((entry) => entry.revision_group_id !== page.revision_group_id)
      : [...state.entries, fromMaster(topicId, page)],
  })),

  remove: (groupId) => set((state) => ({
    entries: state.entries.filter((entry) => entry.revision_group_id !== groupId),
  })),

  clearTopic: (topicId) => set((state) => ({
    entries: state.entries.filter((entry) => entry.topic_id !== topicId),
  })),

  clearAll: () => set({ entries: [] }),

  move: (from, to) => set((state) => ({ entries: reorder(state.entries, from, to) })),

  applyVersion: (groupId, version) => set((state) => ({
    entries: state.entries.map((entry) =>
      entry.revision_group_id === groupId
        ? {
            ...entry,
            page_id: version.page_id,
            revision_no: version.revision_no,
            image_url: version.image_url,
            source_file_name: version.source_file_name,
            source_page_no: version.source_page_no,
            created_at: version.created_at,
          }
        : entry,
    ),
  })),

  syncLatest: (topicId, page) => set((state) => ({
    entries: state.entries.map((entry) =>
      entry.topic_id === topicId && entry.revision_group_id === page.revision_group_id
        ? fromMaster(topicId, page)
        : entry,
    ),
  })),
}))


export const selectEntries = (_topicId?: string | null) => (state: SelectionState) => state.entries

export const selectTopicEntries = (topicId: string | null) => (state: SelectionState) =>
  topicId ? state.entries.filter((entry) => entry.topic_id === topicId) : []

export const selectIsSelected = (_topicId: string | null, groupId: string) => (state: SelectionState) =>
  state.entries.some((entry) => entry.revision_group_id === groupId)

export const selectCount = (topicId: string | null) => (state: SelectionState) =>
  topicId ? state.entries.filter((entry) => entry.topic_id === topicId).length : 0
