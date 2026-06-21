// Slice 2 — geometry writeback (undoable).
//
// Maps a solved envelope's variables back to editor geometry and applies them via the editor's
// entity.applyGeometry command, which is wrapped in withSnapshot at the command site — so the whole
// writeback is ONE native, Ctrl-Z-reversible step (undo/redo come for free, no separate contract).
//
// solver.export-project mints point ids e<editorEntityId>_<role> (role in {start,end,center}); the
// solver returns "<pointId>.x|y" variables. parseSolvedVarsToUpdates inverts that back to the owning
// entity's geometry patch. Mirrors the product-layer mapping (apps/web native_solve.js) so the desktop
// (cadgf-native) loop and the product loop write back identically.
//
// Pure/composable: parseSolvedVarsToUpdates is data-only; applySolvedGeometry takes the commandBus, so
// both are unit-testable, and the writeback is verifiable end-to-end against a real DocumentState.

const POINT_KEY = /^e(\d+)_(start|end|center)$/;

// { "e<id>_<role>.x|y": value } -> [{ id:<editorId>, patch:{ start?/end?/center?:{x,y} } }].
// Incomplete points (missing x or y) and non-point vars are skipped, so a partial solve writes back
// only the points it fully resolved.
export function parseSolvedVarsToUpdates(vars) {
  const byEntity = new Map(); // editorId -> { start?:{x,y}, end?:{x,y}, center?:{x,y} }
  for (const [key, value] of Object.entries(vars ?? {})) {
    if (!Number.isFinite(value)) continue;
    const dot = key.lastIndexOf('.');
    if (dot < 0) continue;
    const coord = key.slice(dot + 1);
    if (coord !== 'x' && coord !== 'y') continue;
    const match = POINT_KEY.exec(key.slice(0, dot));
    if (!match) continue;
    const id = Number(match[1]);
    const role = match[2];
    if (!byEntity.has(id)) byEntity.set(id, {});
    (byEntity.get(id)[role] ??= {})[coord] = value;
  }
  const updates = [];
  for (const [id, roles] of byEntity) {
    const patch = {};
    for (const role of ['start', 'end', 'center']) {
      const p = roles[role];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) patch[role] = { x: p.x, y: p.y };
    }
    if (Object.keys(patch).length > 0) updates.push({ id, patch });
  }
  return updates;
}

// Apply a solved envelope's geometry to the editor, undoably (one entity.applyGeometry command).
// Returns { ok, applied, updates, result?, message }. A no-op (no mappable vars) returns ok:true /
// applied:0 WITHOUT touching the document or pushing an undo step. The caller should only invoke this
// for a SOLVED result (never on a blocked/unsatisfied one) — see runSolveAndShow's status.
export function applySolvedGeometry(commandBus, envelope) {
  if (!commandBus || typeof commandBus.execute !== 'function') {
    return { ok: false, applied: 0, updates: [], message: 'command bus unavailable' };
  }
  const updates = parseSolvedVarsToUpdates(envelope?.vars);
  if (updates.length === 0) {
    return { ok: true, applied: 0, updates, message: 'no geometry to write back' };
  }
  const result = commandBus.execute('entity.applyGeometry', { updates });
  return {
    ok: result?.ok === true,
    applied: result?.ok === true ? updates.length : 0,
    updates,
    result,
    message: result?.message,
  };
}
