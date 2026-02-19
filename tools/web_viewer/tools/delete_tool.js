export function createDeleteTool(ctx) {
  return {
    id: 'delete',
    label: 'Delete',
    toolState: 'idle',
    activate() {
      ctx.setStatus('Delete: click entity or delete current selection');
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      const hit = ctx.pickEntityAt(event.world);
      if (hit) {
        ctx.selection.setSelection([hit.id], hit.id);
      }
      const result = ctx.commandBus.execute('selection.delete');
      ctx.setStatus(result.ok ? (result.message || 'Deleted') : (result.message || 'Delete failed'));
    },
    onKeyDown(event) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const result = ctx.commandBus.execute('selection.delete');
        ctx.setStatus(result.ok ? (result.message || 'Deleted') : (result.message || 'Delete failed'));
      }
    },
  };
}
