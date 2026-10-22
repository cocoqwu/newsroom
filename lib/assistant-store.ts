"use client";
// Tiny client-side store so the right panel (rendered by the layout) can act on the page's
// draft: the Draft screen registers itself and the current text selection here.
import { useSyncExternalStore } from "react";

export type AssistantState = {
  draftId: number | null;
  draftTitle: string | null;
  selection: string;
  busy: boolean;
  history: { instruction: string; before: string; after: string; version: number; provider: string }[];
  lastError: string | null;
};

let state: AssistantState = { draftId: null, draftTitle: null, selection: "", busy: false, history: [], lastError: null };
const listeners = new Set<() => void>();

export const assistantStore = {
  get: () => state,
  set(patch: Partial<AssistantState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export function useAssistant(): AssistantState {
  return useSyncExternalStore(assistantStore.subscribe, assistantStore.get, assistantStore.get);
}
