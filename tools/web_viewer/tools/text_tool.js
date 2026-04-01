export function createTextTool(ctx) {
  return {
    id: 'text',
    label: 'Text',
    toolState: 'idle',
    activate() {
      ctx.setStatus('Text: click insertion point, command input can override content');
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      const snapped = ctx.resolveSnappedPoint(event.world);
      const input = ctx.readCommandInput();
      const value = input?.text && input.text.trim().length > 0 ? input.text.trim() : 'TEXT';
      const height = Number.isFinite(input?.height) ? input.height : 2.5;
      const entity = typeof ctx.buildDraftEntity === 'function'
        ? ctx.buildDraftEntity({
          type: 'text',
          position: { ...snapped.point },
          value,
          height: Math.max(0.5, height),
          rotation: 0,
        })
        : {
          type: 'text',
          position: { ...snapped.point },
          value,
          height: Math.max(0.5, height),
          rotation: 0,
          layerId: typeof ctx.getCurrentLayerId === 'function' ? ctx.getCurrentLayerId() : 0,
          visible: true,
          color: '#111827',
        };
      const result = ctx.commandBus.execute('entity.create', { entity });
      ctx.setStatus(result.ok ? `Text created: ${value}` : (result.message || 'Text create failed'));
    },
  };
}
