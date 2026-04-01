import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePropertyPanelRenderDeps } from '../ui/property_panel_render_deps.js';

test('empty deps resolves all real collaborators as functions', () => {
  const resolved = resolvePropertyPanelRenderDeps();
  assert.equal(typeof resolved.renderSelectionShells, 'function');
  assert.equal(typeof resolved.resolveSelectionContext, 'function');
  assert.equal(typeof resolved.buildBranchState, 'function');
  assert.equal(typeof resolved.executeBranch, 'function');
});

test('returned object has exactly the expected keys', () => {
  const resolved = resolvePropertyPanelRenderDeps({});
  const keys = Object.keys(resolved).sort();
  assert.deepEqual(keys, [
    'buildBranchState',
    'executeBranch',
    'renderSelectionShells',
    'resolveSelectionContext',
  ]);
});

test('injected renderPropertySelectionShells overrides renderSelectionShells', () => {
  const custom = () => 'custom-shells';
  const resolved = resolvePropertyPanelRenderDeps({
    renderPropertySelectionShells: custom,
  });
  assert.equal(resolved.renderSelectionShells, custom);
  // other collaborators remain real
  assert.notEqual(resolved.resolveSelectionContext, custom);
  assert.notEqual(resolved.buildBranchState, custom);
  assert.notEqual(resolved.executeBranch, custom);
});

test('injected resolvePropertyPanelSelectionContext overrides resolveSelectionContext', () => {
  const custom = () => 'custom-context';
  const resolved = resolvePropertyPanelRenderDeps({
    resolvePropertyPanelSelectionContext: custom,
  });
  assert.equal(resolved.resolveSelectionContext, custom);
  assert.notEqual(resolved.renderSelectionShells, custom);
});

test('injected buildPropertyPanelRenderBranchState overrides buildBranchState', () => {
  const custom = () => 'custom-branch-state';
  const resolved = resolvePropertyPanelRenderDeps({
    buildPropertyPanelRenderBranchState: custom,
  });
  assert.equal(resolved.buildBranchState, custom);
  assert.notEqual(resolved.executeBranch, custom);
});

test('injected executePropertyPanelRenderBranch overrides executeBranch', () => {
  const custom = () => 'custom-execute';
  const resolved = resolvePropertyPanelRenderDeps({
    executePropertyPanelRenderBranch: custom,
  });
  assert.equal(resolved.executeBranch, custom);
  assert.notEqual(resolved.buildBranchState, custom);
});

test('multiple injected collaborators override independently', () => {
  const customShells = () => 'shells';
  const customContext = () => 'context';
  const resolved = resolvePropertyPanelRenderDeps({
    renderPropertySelectionShells: customShells,
    resolvePropertyPanelSelectionContext: customContext,
  });
  assert.equal(resolved.renderSelectionShells, customShells);
  assert.equal(resolved.resolveSelectionContext, customContext);
  assert.notEqual(resolved.buildBranchState, customShells);
  assert.notEqual(resolved.executeBranch, customContext);
});
