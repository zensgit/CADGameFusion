import { createTwoTargetModifyTool } from './two_target_modify_tool_factory.js';

export function createFilletTool(ctx) {
  return createTwoTargetModifyTool(ctx, {
    id: 'fillet',
    label: 'Fillet',
    pickFirstPrompt: 'Click first line/polyline/arc/circle',
    pairPrompt: 'Click near corner on either selected target',
    polylineFirstPrompt: 'Click near first side on selected polyline',
    polylineSecondPrompt: 'Click near second side on selected polyline',
    pickSecondPrompt: 'Click second target',
    canceledStatus: 'Fillet canceled',
    createInitialParams() {
      return { radius: 1.0 };
    },
    syncParamsFromCommandInput(params, input) {
      const args = Array.isArray(input?.args) ? input.args : [];
      const parsed = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
      if (Number.isFinite(parsed) && parsed > 1e-9) {
        params.radius = parsed;
      }
    },
    formatPromptPrefix(params) {
      return `Fillet: radius=${params.radius.toFixed(2)}.`;
    },
    buildCommand({ firstId, secondId, firstPick, secondPick, params }) {
      return {
        id: 'selection.filletByPick',
        payload: {
          firstId,
          secondId,
          pick1: firstPick,
          pick2: secondPick,
          radius: params.radius,
        },
        okStatus: 'Fillet applied',
        failStatus: 'Fillet failed',
      };
    },
    shouldBlockSameEntitySelectionFallback() {
      return false;
    },
  });
}
