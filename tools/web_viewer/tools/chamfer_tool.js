import { createTwoTargetModifyTool } from './two_target_modify_tool_factory.js';

export function createChamferTool(ctx) {
  return createTwoTargetModifyTool(ctx, {
    id: 'chamfer',
    label: 'Chamfer',
    pickFirstPrompt: 'Click first line/polyline/arc/circle',
    pairPrompt: 'Click near corner on either selected target',
    polylineFirstPrompt: 'Click near first side on selected polyline',
    polylineSecondPrompt: 'Click near second side on selected polyline',
    pickSecondPrompt: 'Click second line/polyline/arc/circle',
    canceledStatus: 'Chamfer canceled',
    createInitialParams() {
      return { d1: 1.0, d2: 1.0 };
    },
    syncParamsFromCommandInput(params, input) {
      const args = Array.isArray(input?.args) ? input.args : [];
      const parsed1 = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
      const parsed2 = args.length > 1 ? Number.parseFloat(args[1]) : NaN;
      if (Number.isFinite(parsed1) && parsed1 > 1e-9) {
        params.d1 = parsed1;
        params.d2 = Number.isFinite(parsed2) && parsed2 > 1e-9 ? parsed2 : parsed1;
      }
    },
    formatPromptPrefix(params) {
      return `Chamfer: d1=${params.d1.toFixed(2)} d2=${params.d2.toFixed(2)}.`;
    },
    buildCommand({ firstId, secondId, firstPick, secondPick, params }) {
      return {
        id: 'selection.chamferByPick',
        payload: {
          firstId,
          secondId,
          pick1: firstPick,
          pick2: secondPick,
          d1: params.d1,
          d2: params.d2,
        },
        okStatus: 'Chamfer applied',
        failStatus: 'Chamfer failed',
      };
    },
    shouldBlockSameEntitySelectionFallback({ firstEntity, firstPickFromFallback }) {
      const polylineCornerPointCount = Array.isArray(firstEntity?.points) ? firstEntity.points.length : 0;
      return firstPickFromFallback === true && polylineCornerPointCount < 3;
    },
  });
}
