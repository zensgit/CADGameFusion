import { createSelectTool } from './select_tool.js';
import { createLineTool } from './line_tool.js';
import { createPolylineTool } from './polyline_tool.js';
import { createCircleTool } from './circle_tool.js';
import { createArcTool } from './arc_tool.js';
import { createTextTool } from './text_tool.js';
import { createMoveTool } from './move_tool.js';
import { createCopyTool } from './copy_tool.js';
import { createOffsetTool } from './offset_tool.js';
import { createRotateTool } from './rotate_tool.js';
import { createBreakTool } from './break_tool.js';
import { createTrimTool } from './trim_tool.js';
import { createExtendTool } from './extend_tool.js';
import { createFilletTool } from './fillet_tool.js';
import { createChamferTool } from './chamfer_tool.js';
import { createDeleteTool } from './delete_tool.js';

export function createToolRegistry(ctx) {
  const tools = [
    createSelectTool(ctx),
    createLineTool(ctx),
    createPolylineTool(ctx),
    createCircleTool(ctx),
    createArcTool(ctx),
    createTextTool(ctx),
    createMoveTool(ctx),
    createCopyTool(ctx),
    createOffsetTool(ctx),
    createRotateTool(ctx),
    createBreakTool(ctx),
    createTrimTool(ctx),
    createExtendTool(ctx),
    createFilletTool(ctx),
    createChamferTool(ctx),
    createDeleteTool(ctx),
  ];
  const byId = new Map();
  for (const tool of tools) {
    byId.set(tool.id, tool);
  }
  return {
    tools,
    get(id) {
      return byId.get(id) || null;
    },
  };
}
