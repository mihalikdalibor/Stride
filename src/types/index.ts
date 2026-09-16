export type TaskStatus = 'todo' | 'done'
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Category {
  id: string
  name: string
  color: string
  position?: number
  created_at?: string
}

export interface NoteFolder {
  id: string
  name: string
  position: number
  created_at: string
}

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  folder_id: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  title: string
  task_date: string            // 'YYYY-MM-DD'
  task_time: string | null     // 'HH:MM' (local) or null = no specific time
  duration_min: number | null  // estimated duration in minutes, or null
  priority: boolean            // flagged as important
  repeat: TaskRepeat           // recurrence; spawns the next on complete
  status: TaskStatus
  category_id: string | null
  note: string | null
  position: number             // order within a day
  created_at: string
  completed_at: string | null
}

// A subscribed iCal/ICS feed ("Connect calendar")
export interface CalendarFeed {
  id: string
  name: string
  url: string
  category_id: string | null   // applies to all of the feed's events
  last_synced_at: string | null
  last_error: string | null     // error code from the last failed sync
  created_at: string
}

// One occurrence from a feed (recurrences are expanded server-side). Read-only
// except `hidden` — the user can remove an event without touching the source.
export interface CalendarEvent {
  id: string
  feed_id: string
  uid: string
  title: string
  location: string | null
  starts_at: string   // ISO; all-day → date at 00:00Z
  ends_at: string     // ISO; all-day → exclusive end date at 00:00Z
  all_day: boolean
  hidden: boolean
}
