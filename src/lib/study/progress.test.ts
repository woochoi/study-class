import test from 'node:test'
import assert from 'node:assert/strict'
import { ddayLabel, nextCardLevel, priorityUnits, toggleRead, weightedProgress } from './progress.ts'
import type { Area, Unit } from './types.ts'

const unit = (id: string): Unit => ({
  id, name: id, lawSummary: '', decreeSummary: '', leaves: [], items: [],
})
const areas: Area[] = [
  { id: 'a1', roman: 'I', name: 'A1', weight: 10, units: [unit('a1-1'), unit('a1-2')] },
  { id: 'a4', roman: 'IV', name: 'A4', weight: 30, units: [unit('a4-1'), unit('a4-2')] },
  { id: 'a5', roman: 'V', name: 'A5', weight: 60, units: [unit('a5-1')] },
]

test('weightedProgress: nothing read is 0', () => {
  assert.equal(weightedProgress(areas, {}), 0)
})

test('weightedProgress: both a4 units fully read is 30', () => {
  assert.equal(weightedProgress(areas, { 'a4-1': 3, 'a4-2': 3 }), 30)
})

test('weightedProgress: partial reads average then round', () => {
  assert.equal(weightedProgress(areas, { 'a4-1': 3 }), 15)
  assert.equal(weightedProgress(areas, { 'a5-1': 1 }), 20)
})

test('priorityUnits: highest score first, a4 leads', () => {
  const p = priorityUnits(areas, {})
  assert.equal(p[0].area.id, 'a5')
  const p2 = priorityUnits(areas, { 'a5-1': 3 })
  assert.equal(p2[0].area.id, 'a4')
  assert.equal(p2[0].score, 15)
})

test('priorityUnits: excludes zero scores and honors limit', () => {
  const done = { 'a1-1': 3, 'a1-2': 3, 'a4-1': 3, 'a4-2': 3, 'a5-1': 3 }
  assert.deepEqual(priorityUnits(areas, done), [])
  assert.equal(priorityUnits(areas, {}, 2).length, 2)
  assert.equal(priorityUnits(areas, {}).length, 4)
})

test('nextCardLevel', () => {
  assert.equal(nextCardLevel(3, true), 3)
  assert.equal(nextCardLevel(1, true), 2)
  assert.equal(nextCardLevel(2, false), 1)
})

test('ddayLabel', () => {
  const today = new Date('2026-11-03T15:00:00')
  assert.equal(ddayLabel('2026-11-15', today), 'D-12')
  assert.equal(ddayLabel('2026-11-03', today), 'D-Day')
  assert.equal(ddayLabel('2026-10-31', today), 'D+3')
  assert.equal(ddayLabel(null, today), 'D-?')
})

test('toggleRead', () => {
  assert.equal(toggleRead(2, 2), 1)
  assert.equal(toggleRead(0, 3), 3)
  assert.equal(toggleRead(1, 3), 3)
})
