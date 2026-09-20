export type TaskStatus = 'todo' | 'done'
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Category {
  id: string
  name: string
  color: string
  position?: number
  exclude_from_streak: boolean   // its tasks don't count toward the streak
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

export type ItemKind = 'task' | 'event'

// What the add/edit item form hands back: an activity (task) or a fixed event.
export interface ItemDraft {
  kind: ItemKind
  title: string
  note: string | null
  task_time: string | null      // 'HH:MM' start, null = no time (event → all-day)
  duration_min: number | null   // end as minutes after the start
  category_id: string | null
  dates: string[]               // add: the day(s) to create; edit: the single (possibly moved) day
  series: boolean               // dates came from a repeat rule → they share a series_id
  scope: 'one' | 'following'    // edit: how far a change to a series item reaches
  clearRepeat?: boolean         // edit: turn off a legacy `repeat` (spawn-on-complete)
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
  series_id: string | null     // set on every occurrence created from one repeat rule
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

// One occurrence from a feed (recurrences are expanded server-side) or a
// manually added event (`feed_id === null`, editable). Feed events are
// read-only except `hidden` — removing one doesn't touch the source.
export interface CalendarEvent {
  id: string
  feed_id: string | null   // null = manually added event (not from a feed)
  uid: string
  title: string
  location: string | null
  note: string | null
  starts_at: string   // ISO; all-day → date at 00:00Z
  ends_at: string     // ISO; all-day → exclusive end date at 00:00Z
  all_day: boolean
  hidden: boolean
  category_id: string | null   // manual events; feed events inherit the feed's category
  series_id: string | null
}
