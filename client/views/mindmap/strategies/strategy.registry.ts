import { DiagramSubtype } from '../../../types/mindmap.types.js';
import { ConceptMapStrategy } from './conceptmap.strategy.js';
import { DecisionTreeStrategy } from './decisiontree.strategy.js';
import { DiagramStrategy } from './diagram-strategy.interface.js';
import { FishboneStrategy } from './fishbone.strategy.js';
import { FlowchartStrategy } from './flowchart.strategy.js';
import { KanbanStrategy } from './kanban.strategy.js';
import { MatrixStrategy } from './matrix.strategy.js';
import { MindMapRadialStrategy } from './mindmap-radial.strategy.js';
import { OrgChartStrategy } from './orgchart.strategy.js';
import { TimelineStrategy } from './timeline.strategy.js';

const strategies = new Map<DiagramSubtype, DiagramStrategy>();

const radialStrategy = new MindMapRadialStrategy();
const conceptMapStrategy = new ConceptMapStrategy();
const flowchartStrategy = new FlowchartStrategy();
const decisionTreeStrategy = new DecisionTreeStrategy();
const kanbanStrategy = new KanbanStrategy();
const timelineStrategy = new TimelineStrategy();
const fishboneStrategy = new FishboneStrategy();
const matrixStrategy = new MatrixStrategy();
const orgChartStrategy = new OrgChartStrategy();

strategies.set('mindmap', radialStrategy);
strategies.set('conceptmap', conceptMapStrategy);
strategies.set('flowchart', flowchartStrategy);
strategies.set('decisiontree', decisionTreeStrategy);
strategies.set('kanban', kanbanStrategy);
strategies.set('timeline', timelineStrategy);
strategies.set('fishbone', fishboneStrategy);
strategies.set('matrix', matrixStrategy);
strategies.set('orgchart', orgChartStrategy);

export function getDiagramStrategy(subtype?: DiagramSubtype): DiagramStrategy {
  if (subtype && strategies.has(subtype)) {
    return strategies.get(subtype)!;
  }
  return radialStrategy;
}

export function getAllDiagramStrategies(): DiagramStrategy[] {
  return Array.from(strategies.values());
}
