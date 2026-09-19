import { DiagramSubtype, MindMapNode, MindMapProject } from '../types/mindmap.types.js';

export function getCustomDiagramProject(
  templateId: string,
  subtype: DiagramSubtype,
  title: string
): MindMapProject {
  const rootId = 'root';
  const nodes: Record<string, MindMapNode> = {};

  if (subtype === 'conceptmap') {
    nodes[rootId] = {
      color: '#0284c7',
      fontSize: 15,
      height: 38,
      icon: 'account_tree',
      id: rootId,
      orderIndex: 0,
      parentId: null,
      shape: 'rounded',
      text: title,
      textColor: '#ffffff',
      width: Math.max(160, title.length * 9),
      x: 0,
      y: -180,
    };

    const c1Id = 'c_1';
    const c2Id = 'c_2';
    const s1Id = 's_1';
    const s2Id = 's_2';

    nodes[c1Id] = {
      color: '#0ea5e9',
      fontSize: 13,
      height: 34,
      icon: 'category',
      id: c1Id,
      linkingPhrase: 'se compone de',
      orderIndex: 0,
      parentId: rootId,
      shape: 'rounded',
      text: 'Principios Clave',
      textColor: '#ffffff',
      width: 140,
      x: -160,
      y: -40,
    };

    nodes[c2Id] = {
      color: '#0ea5e9',
      fontSize: 13,
      height: 34,
      icon: 'lightbulb',
      id: c2Id,
      linkingPhrase: 'se aplica en',
      orderIndex: 1,
      parentId: rootId,
      shape: 'rounded',
      text: 'Casos de Uso',
      textColor: '#ffffff',
      width: 140,
      x: 160,
      y: -40,
    };

    nodes[s1Id] = {
      color: '#38bdf8',
      fontSize: 12,
      height: 30,
      icon: 'check',
      id: s1Id,
      linkingPhrase: 'produce',
      orderIndex: 0,
      parentId: c1Id,
      shape: 'rounded',
      text: 'Fundamento Base',
      textColor: '#ffffff',
      width: 130,
      x: -160,
      y: 90,
    };

    nodes[s2Id] = {
      color: '#38bdf8',
      fontSize: 12,
      height: 30,
      icon: 'verified',
      id: s2Id,
      linkingPhrase: 'garantiza',
      orderIndex: 0,
      parentId: c2Id,
      shape: 'rounded',
      text: 'Efectividad y Valor',
      textColor: '#ffffff',
      width: 130,
      x: 160,
      y: 90,
    };

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes,
      rootId,
      subtype: 'conceptmap',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#0284c7', '#0ea5e9', '#38bdf8', '#06b6d4'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'top-down',
        lineStyle: 'straight',
        nodeShape: 'rounded',
      },
      type: 'mindmap',
      version: 1,
    };
  }

  if (subtype === 'flowchart') {
    const step1Id = 'f_step1';
    const decisionId = 'f_decision';
    const yesId = 'f_yes';
    const noId = 'f_no';

    nodes[rootId] = {
      color: '#10b981',
      fontSize: 14,
      height: 36,
      icon: 'play_arrow',
      id: rootId,
      orderIndex: 0,
      parentId: null,
      shape: 'pill',
      text: `Inicio: ${title}`,
      textColor: '#ffffff',
      width: Math.max(160, title.length * 8),
      x: 0,
      y: -180,
    };

    nodes[step1Id] = {
      color: '#3b82f6',
      fontSize: 13,
      height: 34,
      icon: 'settings',
      id: step1Id,
      orderIndex: 0,
      parentId: rootId,
      shape: 'rounded',
      text: 'Procesar Solicitud',
      textColor: '#ffffff',
      width: 160,
      x: 0,
      y: -80,
    };

    nodes[decisionId] = {
      color: '#f59e0b',
      fontSize: 13,
      height: 48,
      icon: 'help',
      id: decisionId,
      orderIndex: 0,
      parentId: step1Id,
      shape: 'diamond',
      text: '¿Requisitos Válidos?',
      textColor: '#ffffff',
      width: 160,
      x: 0,
      y: 30,
    };

    nodes[yesId] = {
      color: '#10b981',
      fontSize: 13,
      height: 34,
      icon: 'check_circle',
      id: yesId,
      linkingPhrase: 'Sí',
      orderIndex: 0,
      parentId: decisionId,
      shape: 'rounded',
      text: 'Aprobado y Finalizado',
      textColor: '#ffffff',
      width: 160,
      x: 180,
      y: 140,
    };

    nodes[noId] = {
      color: '#ef4444',
      fontSize: 13,
      height: 34,
      icon: 'cancel',
      id: noId,
      linkingPhrase: 'No',
      orderIndex: 1,
      parentId: decisionId,
      shape: 'rounded',
      text: 'Revisión y Ajuste',
      textColor: '#ffffff',
      width: 160,
      x: -180,
      y: 140,
    };

    return {
      camera: { x: 0, y: 0, zoom: 1 },
      connections: [],
      nodes,
      rootId,
      subtype: 'flowchart',
      theme: {
        backgroundColor: '#ffffff',
        branchColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
        fontFamily: 'system-ui, -apple-system, sans-serif',
        layoutDirection: 'top-down',
        lineStyle: 'orthogonal',
        nodeShape: 'rounded',
      },
      type: 'mindmap',
      version: 1,
    };
  }

  // Default: Mindmap Radial
  nodes[rootId] = {
    color: '#6366f1',
    fontSize: 16,
    height: 40,
    icon: 'psychology',
    id: rootId,
    orderIndex: 0,
    parentId: null,
    shape: 'pill',
    text: title,
    textColor: '#ffffff',
    width: Math.max(160, title.length * 9),
    x: 0,
    y: 0,
  };

  const b1Id = 'b_1';
  const b2Id = 'b_2';
  const b3Id = 'b_3';
  const b4Id = 'b_4';

  nodes[b1Id] = {
    color: '#3b82f6',
    fontSize: 13,
    height: 32,
    icon: 'flag',
    id: b1Id,
    orderIndex: 0,
    parentId: rootId,
    shape: 'pill',
    text: 'Metas y Alcance',
    textColor: '#ffffff',
    width: 130,
    x: 180,
    y: -70,
  };

  nodes[b2Id] = {
    color: '#10b981',
    fontSize: 13,
    height: 32,
    icon: 'groups',
    id: b2Id,
    orderIndex: 1,
    parentId: rootId,
    shape: 'pill',
    text: 'Equipo y Roles',
    textColor: '#ffffff',
    width: 130,
    x: -180,
    y: -70,
  };

  nodes[b3Id] = {
    color: '#f59e0b',
    fontSize: 13,
    height: 32,
    icon: 'calendar_month',
    id: b3Id,
    orderIndex: 2,
    parentId: rootId,
    shape: 'pill',
    text: 'Cronograma',
    textColor: '#ffffff',
    width: 130,
    x: 180,
    y: 70,
  };

  nodes[b4Id] = {
    color: '#ec4899',
    fontSize: 13,
    height: 32,
    icon: 'verified',
    id: b4Id,
    orderIndex: 3,
    parentId: rootId,
    shape: 'pill',
    text: 'Entregables',
    textColor: '#ffffff',
    width: 130,
    x: -180,
    y: 70,
  };

  return {
    camera: { x: 0, y: 0, zoom: 1 },
    connections: [],
    nodes,
    rootId,
    subtype: 'mindmap',
    theme: {
      backgroundColor: '#ffffff',
      branchColors: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
      fontFamily: 'system-ui, -apple-system, sans-serif',
      layoutDirection: 'radial',
      lineStyle: 'curved',
      nodeShape: 'pill',
    },
    type: 'mindmap',
    version: 1,
  };
}
