import {
  isDirectEditableInsertTextProxyEntity,
} from '../insert_group.js';
import { resolveLayer } from './selection_layer_helpers.js';

export function supportsInsertTextPositionEditing(entity) {
  return isDirectEditableInsertTextProxyEntity(entity)
    && typeof entity?.attributeLockPosition === 'boolean'
    && entity.attributeLockPosition !== true;
}

export { resolveLayer };
