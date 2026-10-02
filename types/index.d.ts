// The part of the latest measurement the mod uses. A field the measurement lacks stays undefined.
export type Reading = {
  fiveHour?: number
  fiveHourResetsAt?: number
  sevenDay?: number
  sevenDayResetsAt?: number
  ctxPercent?: number
  ctxTokens?: number
  ctxWindow: number
  usd?: number
}

// A main-agent turn: its number, end time, context fill, the session's total cost at its end
// (absent when unknown) and the turn's summed token counts.
export type Turn = {
  n: number
  at: number
  ctxPercent: number
  usd?: number
  model?: string
  in: number
  out: number
  cacheRead: number
  cacheWrite: number
}

// A turn for the window breakdown: kept in $.store across sessions.
export type LogEntry = {
  id: string
  at: number
  project: string
  model: string
  tokens: number
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'wavy-usage': {
      reading: Reading | null
      history: Turn[]
      isPaneOpen: boolean
      isEnabled: boolean
      lastRequestAt: number | null
      ttlMs: number
      log: LogEntry[]
      others: LogEntry[]
      windowView: '5h' | '7d'
      effort: 'high' | 'xhigh' | 'max' | null
    }
  }
}
