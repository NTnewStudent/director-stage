/** Bounded document history; selection/playback are intentionally absent. */
import type { DirectorDocument } from './model'

/** Immutable undo/redo state. */
export interface DirectorHistory {
  past: DirectorDocument[]
  present: DirectorDocument
  future: DirectorDocument[]
}

/** Initialize a detached history. @param doc Initial document. @returns Empty history. @throws Never for JSON documents. */
export function createHistory(doc: DirectorDocument): DirectorHistory {
  return { past: [], present: structuredClone(doc), future: [] }
}

/** Commit one completed edit, discarding redo on a new branch. @param history Current history. @param doc Completed document. @returns History retaining at most 80 past edits. @throws Never for JSON documents. */
export function pushHistory(history: DirectorHistory, doc: DirectorDocument): DirectorHistory {
  if (JSON.stringify(history.present) === JSON.stringify(doc)) return history
  return { past: [...history.past, history.present].slice(-80), present: structuredClone(doc), future: [] }
}

/** Undo one document change. @param history Current state. @returns Previous state, or identical history at boundary. @throws Never. */
export function undoHistory(history: DirectorHistory): DirectorHistory {
  if (!history.past.length) return history
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] }
}

/** Redo one document change. @param history Current state. @returns Next state, or identical history at boundary. @throws Never. */
export function redoHistory(history: DirectorHistory): DirectorHistory {
  if (!history.future.length) return history
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) }
}
