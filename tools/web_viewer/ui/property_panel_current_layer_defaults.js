import { formatSpaceLabel } from './selection_presenter.js';

function formatCurrentLayerState(currentLayer) {
  return [
    currentLayer.visible === false ? 'Hidden' : 'Shown',
    currentLayer.locked === true ? 'Locked' : 'Open',
    currentLayer.frozen === true ? 'Frozen' : 'Live',
    currentLayer.printable === false ? 'NoPrint' : 'Print',
    currentLayer.construction === true ? 'Construction' : 'Normal',
  ].join(' / ');
}

export function buildCurrentLayerDefaultContent(currentLayer, currentSpaceContext = null) {
  if (!currentLayer || !Number.isFinite(currentLayer.id)) {
    return {
      note: null,
      infos: [],
    };
  }
  return {
    note: {
      text: 'No selection. Current layer and current space/layout apply to newly created Line/Polyline/Circle/Arc/Text entities.',
      key: 'current-layer-note',
    },
    infos: [
      { label: 'Current Space', value: formatSpaceLabel(currentSpaceContext?.space), key: 'current-space' },
      { label: 'Current Layout', value: currentSpaceContext?.layout, key: 'current-layout' },
      { label: 'Current Layer', value: `${currentLayer.id}:${currentLayer.name}`, key: 'current-layer' },
      { label: 'Layer Color', value: currentLayer.color, key: 'current-layer-color' },
      { label: 'Layer State', value: formatCurrentLayerState(currentLayer), key: 'current-layer-state' },
    ],
  };
}

export function buildCurrentLayerFieldDescriptors(currentLayer, deps = {}) {
  const { updateCurrentLayer = null, setStatus = null } = deps;
  if (!currentLayer || !Number.isFinite(currentLayer.id) || typeof updateCurrentLayer !== 'function') {
    return [];
  }
  return [
    {
      config: {
        label: 'Current Layer Color (#RRGGBB)',
        name: 'currentLayerColor',
        value: currentLayer.color || '#9ca3af',
      },
      onChange: (value) => {
        const ok = updateCurrentLayer(currentLayer.id, { color: value || '#9ca3af' });
        if (typeof setStatus === 'function') {
          setStatus(ok === false ? `Current layer color unchanged: ${currentLayer.name}` : `Current layer color: ${currentLayer.name}`);
        }
      },
    },
    {
      config: {
        label: 'Current Layer Line Type',
        name: 'currentLayerLineType',
        value: currentLayer.lineType || 'CONTINUOUS',
      },
      onChange: (value) => {
        const ok = updateCurrentLayer(currentLayer.id, { lineType: value || 'CONTINUOUS' });
        if (typeof setStatus === 'function') {
          setStatus(ok === false ? `Current layer line type unchanged: ${currentLayer.name}` : `Current layer line type: ${currentLayer.name}`);
        }
      },
    },
    {
      config: {
        label: 'Current Layer Line Weight',
        name: 'currentLayerLineWeight',
        type: 'number',
        value: String(Number.isFinite(currentLayer.lineWeight) ? currentLayer.lineWeight : 0),
        step: '0.05',
      },
      onChange: (value) => {
        const num = Number.parseFloat(value);
        const lineWeight = Number.isFinite(num) ? num : (currentLayer.lineWeight || 0);
        const ok = updateCurrentLayer(currentLayer.id, { lineWeight });
        if (typeof setStatus === 'function') {
          setStatus(ok === false ? `Current layer line weight unchanged: ${currentLayer.name}` : `Current layer line weight: ${currentLayer.name}`);
        }
      },
    },
  ];
}
