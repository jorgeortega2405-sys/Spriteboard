import { MindMapProject } from '../../types/mindmap.types.js';
import { ComputedNodeLayout } from './strategies/diagram-strategy.interface.js';
import { estimateNodeDimensions } from './strategies/strategy-helper.js';
import { getDiagramStrategy } from './strategies/strategy.registry.js';

export type { ComputedNodeLayout };
export { estimateNodeDimensions };

export function computeMindMapTreeLayout(project: MindMapProject): Map<string, ComputedNodeLayout> {
  const strategy = getDiagramStrategy(project.subtype);
  return strategy.computeLayout(project);
}
