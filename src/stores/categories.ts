import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { DEMO_CATEGORIES, isDemo } from '@/lib/demo'
import { useTasksStore } from '@/stores/tasks'
import { useCalendarsStore } from '@/stores/calendars'
import type { Category } from '@/types'

// what a deleted category was linked to, so undo can re-link it
export type Affected = { taskIds: string[]; eventIds: string[] }

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loaded = ref(false)

  const byId = computed(() => {
    const m = new Map<string, Category>()
    for (const c of categories.value) m.set(c.id, c)
    return m
  })

  function color(id: string | null): string | null {
    return id ? byId.value.get(id)?.color ?? null : null
  }

  // whether a task in this category counts toward the streak (see CLAUDE.md)
  function countsToStreak(id: string | null): boolean {
    return id ? !byId.value.get(id)?.exclude_from_streak : true
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

  const nextPosition = () =>
    categories.value.length ? Math.max(...categories.value.map(c => c.position ?? 0)) + 1 : 0

  async function addCategory(name: string, color: string): Promise<Category> {
    const position = nextPosition()
    if (isDemo) {
      const cat: Category = { id: `demo-cat-${crypto.randomUUID()}`, name, color, position, exclude_from_streak: false }
      categories.value.push(cat)
      return cat
    }
    const { data, error } = await supabase
      .from('categories').insert({ name, color, position }).select().single()
    if (error) throw error
    categories.value.push(data)
    return data
  }

  // persist a new order (drag & drop in the categories sheet)
  async function reorderCategories(ordered: Category[]) {
    categories.value = ordered
    ordered.forEach((c, i) => { c.position = i })
    if (!isDemo) {
      await Promise.all(ordered.map((c, i) =>
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

  // returns the ids of the tasks and manual events that had this category
  // (for undo re-linking)
  async function deleteCategory(id: string): Promise<Affected> {
    if (!isDemo) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    }
    categories.value = categories.value.filter(c => c.id !== id)
    // mirror the DB's `on delete set null` on the loaded rows
    const tasks = useTasksStore()
    const calendars = useCalendarsStore()
    const affected: Affected = { taskIds: [], eventIds: [] }
    for (const t of tasks.tasks) if (t.category_id === id) { affected.taskIds.push(t.id); t.category_id = null }
    for (const e of calendars.allLoadedEvents) {
      if (e.category_id === id) {
        if (!affected.eventIds.includes(e.id)) affected.eventIds.push(e.id)
        e.category_id = null
      }
    }
    return affected
  }

  // re-insert a deleted category (for undo) and re-link what had it
  async function restoreCategory(cat: Category, { taskIds, eventIds }: Affected) {
    let newId = cat.id
    if (isDemo) {
      categories.value.push({ ...cat })
    } else {
      const { data, error } = await supabase
        .from('categories').insert({ name: cat.name, color: cat.color, exclude_from_streak: cat.exclude_from_streak }).select().single()
      if (error) throw error
      categories.value.push(data)
      newId = data.id
    }
    const tasks = useTasksStore()
    for (const id of taskIds) {
      const tk = tasks.tasks.find(x => x.id === id)
      if (tk) tk.category_id = newId
    }
    const calendars = useCalendarsStore()
    for (const e of calendars.allLoadedEvents) if (eventIds.includes(e.id)) e.category_id = newId
    if (!isDemo) {
      await Promise.all([
        ...taskIds.map(id => supabase.from('tasks').update({ category_id: newId }).eq('id', id)),
        ...(eventIds.length
          ? [supabase.from('calendar_events').update({ category_id: newId }).in('id', eventIds)]
          : []),
      ])
    }
  }

  return { categories, loaded, byId, color, countsToStreak, fetchAll, addCategory, updateCategory, deleteCategory, restoreCategory, reorderCategories }
})
