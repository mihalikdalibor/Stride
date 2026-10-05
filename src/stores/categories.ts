import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { DEMO_CATEGORIES, isDemo } from '@/lib/demo'
import { useTasksStore } from '@/stores/tasks'
import { useCalendarsStore } from '@/stores/calendars'
import type { Category } from '@/types'

// the "Bez kategórie" entry of a category filter
export const NO_CAT = '__none__'

// what a deleted category (and its subcategories) was linked to, so undo can
// re-create the tree and re-link everything — also rows that weren't loaded
export type CategoryLinks = { taskIds: string[]; eventIds: string[]; feedIds: string[] }
export type CategoryTomb = { cats: Category[]; links: Record<string, CategoryLinks> }

const byPos = (a: Category, b: Category) => (a.position ?? 0) - (b.position ?? 0)

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loaded = ref(false)

  const byId = computed(() => {
    const m = new Map<string, Category>()
    for (const c of categories.value) m.set(c.id, c)
    return m
  })

  // --- one level of subcategories (see CLAUDE.md) ---
  // the parent of a subcategory, only while it's loaded (an orphan acts top-level)
  function parentOf(id: string | null): Category | null {
    const p = id ? byId.value.get(id)?.parent_id : null
    return p ? byId.value.get(p) ?? null : null
  }
  const rootId = (id: string) => parentOf(id)?.id ?? id
  const childrenOf = (id: string) => categories.value.filter(c => c.parent_id === id).sort(byPos)
  const isTop = (c: Category) => !parentOf(c.id)
  const topLevel = computed(() => categories.value.filter(isTop).sort(byPos))
  // the user's order: each top-level category followed by its subcategories
  const ordered = computed(() => topLevel.value.flatMap(c => [c, ...childrenOf(c.id)]))

  // a subcategory inherits its parent's color and streak flag
  function color(id: string | null): string | null {
    return id ? byId.value.get(rootId(id))?.color ?? null : null
  }

  // whether a task in this category counts toward the streak (see CLAUDE.md)
  function countsToStreak(id: string | null): boolean {
    return id ? !byId.value.get(rootId(id))?.exclude_from_streak : true
  }

  // "Práca › Firma A" for a subcategory, the plain name otherwise
  function label(id: string): string {
    const c = byId.value.get(id)
    if (!c) return ''
    const p = parentOf(id)
    return p ? `${p.name} › ${c.name}` : c.name
  }

  // category filter (Home + Stats): empty = everything; a parent also matches
  // its subcategories; NO_CAT matches items without a category
  function matchesFilter(categoryId: string | null, selected: Set<string>): boolean {
    if (!selected.size) return true
    if (!categoryId) return selected.has(NO_CAT)
    return selected.has(categoryId) || selected.has(rootId(categoryId))
  }

  async function fetchAll() {
    if (isDemo) {
      if (!loaded.value) categories.value = DEMO_CATEGORIES.map(c => ({ ...c }))
      loaded.value = true
      return
    }
    const { data, error } = await supabase
      // `*` (not a column list) so a database without the newest migration
      // still returns its categories — the missing flag just reads as false
      .from('categories').select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    categories.value = data ?? []
    loaded.value = true
  }

  // next free position among the siblings (top level or one parent's children)
  function nextPosition(parentId: string | null) {
    const group = parentId ? childrenOf(parentId) : topLevel.value
    return group.length ? Math.max(...group.map(c => c.position ?? 0)) + 1 : 0
  }

  async function addCategory(name: string, color: string, parent_id: string | null = null): Promise<Category> {
    // only one level: a parent that's missing or itself a subcategory → top-level
    const candidate = parent_id ? byId.value.get(parent_id) ?? null : null
    const parent = candidate && isTop(candidate) ? candidate : null
    // `parent_id` is only sent when set, so a DB without the migration still works
    const row = {
      name, color: parent?.color ?? color, position: nextPosition(parent?.id ?? null),
      ...(parent ? { parent_id: parent.id, exclude_from_streak: parent.exclude_from_streak } : {}),
    }
    if (isDemo) {
      const cat: Category = { exclude_from_streak: false, ...row, id: `demo-cat-${crypto.randomUUID()}` }
      categories.value.push(cat)
      return cat
    }
    const { data, error } = await supabase.from('categories').insert(row).select().single()
    if (error) throw error
    categories.value.push(data)
    return data
  }

  // attach a category under a top-level one, or detach it (parentId = null);
  // only one level: a category with subcategories can't become one
  async function setParent(id: string, parentId: string | null) {
    const c = byId.value.get(id)
    if (!c || (c.parent_id ?? null) === parentId) return
    const parent = parentId ? byId.value.get(parentId) : null
    if (parentId && (!parent || parentId === id || !isTop(parent) || childrenOf(id).length)) {
      throw new Error('invalid parent category')
    }
    const old = parentOf(id)
    const updates: Partial<Category> = { parent_id: parentId, position: nextPosition(parentId) }
    // a detached subcategory keeps what it inherited as its own
    if (!parentId && old) Object.assign(updates, { color: old.color, exclude_from_streak: old.exclude_from_streak })
    if (!isDemo) {
      const { error } = await supabase.from('categories').update(updates).eq('id', id)
      if (error) throw error
    }
    Object.assign(c, updates)
  }

  // persist a new order of one sibling group (drag & drop in the categories sheet)
  async function reorderGroup(group: Category[]) {
    group.forEach((c, i) => { c.position = i })
    if (!isDemo) {
      await Promise.all(group.map((c, i) =>
        supabase.from('categories').update({ position: i }).eq('id', c.id)))
    }
  }

  async function updateCategory(id: string, updates: Partial<Pick<Category, 'name' | 'color' | 'exclude_from_streak'>>) {
    if (!isDemo) {
      const { error } = await supabase.from('categories').update(updates).eq('id', id)
      if (error) throw error
    }
    const c = categories.value.find(x => x.id === id)
    if (c) Object.assign(c, updates)
  }

  // ids of `table` rows linked to any of `ids`, paged past PostgREST's 1000-row cap
  async function linkedRows(table: 'tasks' | 'calendar_events' | 'calendar_feeds', ids: string[]) {
    const PAGE = 1000
    const out: { id: string; category_id: string | null }[] = []
    for (let i = 0; ; i += PAGE) {
      const { data, error } = await supabase
        .from(table).select('id, category_id').in('category_id', ids)
        .order('id', { ascending: true }).range(i, i + PAGE - 1)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    return out
  }

  // everything linked to `ids`: loaded rows plus (outside demo) the DB's
  async function linksOf(ids: string[]): Promise<Record<string, CategoryLinks>> {
    const sets = new Map(ids.map(id => [id, { taskIds: new Set<string>(), eventIds: new Set<string>(), feedIds: new Set<string>() }]))
    const add = (key: 'taskIds' | 'eventIds' | 'feedIds', rows: { id: string; category_id: string | null }[]) => {
      for (const r of rows) if (r.category_id) sets.get(r.category_id)?.[key].add(r.id)
    }
    const tasks = useTasksStore()
    const calendars = useCalendarsStore()
    add('taskIds', [...tasks.tasks, ...tasks.overdue])
    add('eventIds', calendars.allLoadedEvents)
    add('feedIds', calendars.feeds)
    if (!isDemo) {
      // best effort: a failed lookup (e.g. the calendars migration not run)
      // mustn't block the delete — undo then re-links only the loaded rows
      const safe = (table: 'tasks' | 'calendar_events' | 'calendar_feeds') =>
        linkedRows(table, ids).catch(e => { console.error(`category links (${table}) failed`, e); return [] })
      const [t, e, f] = await Promise.all([safe('tasks'), safe('calendar_events'), safe('calendar_feeds')])
      add('taskIds', t); add('eventIds', e); add('feedIds', f)
    }
    return Object.fromEntries([...sets].map(([id, s]) => [id, {
      taskIds: [...s.taskIds], eventIds: [...s.eventIds], feedIds: [...s.feedIds],
    }]))
  }

  // Deletes the category and its subcategories (the DB cascades them) and
  // returns what's needed to undo it.
  async function deleteCategory(id: string): Promise<CategoryTomb> {
    const cat = byId.value.get(id)
    if (!cat) return { cats: [], links: {} }
    const cats = [cat, ...childrenOf(id)].map(c => ({ ...c }))
    const ids = cats.map(c => c.id)
    const links = await linksOf(ids)
    if (!isDemo) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    }
    categories.value = categories.value.filter(c => !ids.includes(c.id))
    // mirror the DB's `on delete set null` on the loaded rows
    const gone = (cid: string | null) => !!cid && ids.includes(cid)
    const tasks = useTasksStore()
    const calendars = useCalendarsStore()
    for (const t of [...tasks.tasks, ...tasks.overdue]) if (gone(t.category_id)) t.category_id = null
    for (const e of calendars.allLoadedEvents) if (gone(e.category_id)) e.category_id = null
    for (const f of calendars.feeds) if (gone(f.category_id)) f.category_id = null
    return { cats, links }
  }

  // re-insert a deleted category tree (for undo) and re-link what had it; the
  // first entry is the deleted category, the rest its subcategories
  async function restoreCategory({ cats, links }: CategoryTomb) {
    const newIds = new Map<string, string>()
    for (const c of cats) {
      // a subcategory whose parent is gone meanwhile comes back top-level
      const parentId = c.parent_id
        ? newIds.get(c.parent_id) ?? (byId.value.has(c.parent_id) ? c.parent_id : null)
        : null
      const row = {
        name: c.name, color: c.color, position: c.position ?? 0, exclude_from_streak: c.exclude_from_streak,
        ...(parentId ? { parent_id: parentId } : {}),
      }
      if (isDemo) {
        categories.value.push({ ...row, id: c.id, parent_id: parentId })
        newIds.set(c.id, c.id)
        continue
      }
      const { data, error } = await supabase.from('categories').insert(row).select().single()
      if (error) throw error
      categories.value.push(data)
      newIds.set(c.id, data.id)
    }

    const tasks = useTasksStore()
    const calendars = useCalendarsStore()
    for (const [oldId, l] of Object.entries(links)) {
      const newId = newIds.get(oldId)
      if (!newId) continue
      for (const t of [...tasks.tasks, ...tasks.overdue]) if (l.taskIds.includes(t.id)) t.category_id = newId
      for (const e of calendars.allLoadedEvents) if (l.eventIds.includes(e.id)) e.category_id = newId
      for (const f of calendars.feeds) if (l.feedIds.includes(f.id)) f.category_id = newId
      if (isDemo) continue
      const relink = (table: 'tasks' | 'calendar_events' | 'calendar_feeds', rowIds: string[]) =>
        Array.from({ length: Math.ceil(rowIds.length / 100) }, (_, i) =>
          supabase.from(table).update({ category_id: newId }).in('id', rowIds.slice(i * 100, i * 100 + 100)))
      await Promise.all([
        ...relink('tasks', l.taskIds), ...relink('calendar_events', l.eventIds), ...relink('calendar_feeds', l.feedIds),
      ])
    }
  }

  return {
    categories, loaded, byId, ordered, topLevel,
    parentOf, rootId, childrenOf, color, countsToStreak, label, matchesFilter,
    fetchAll, addCategory, setParent, updateCategory, deleteCategory, restoreCategory, reorderGroup,
  }
})
