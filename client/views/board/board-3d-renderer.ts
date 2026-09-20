import { Face3D, Model3D, Vec3, getLoadedCustomModel, loadCustomOBJModel, onCustomModelLoaded, preloadCustom3DModels } from './board-obj-loader.js';
import { Board3DElement, BoardElement, BoardPoint, Shape3DType } from './board.types.js';

export { onCustomModelLoaded, preloadCustom3DModels };

export interface Projected3DFace {
  color: string;
  depth: number;
  points: BoardPoint[];
  strokeColor: string;
  strokeWidth: number;
}

const LIGHT_DIR: Vec3 = normalizeVec3({ x: 0.45, y: -0.65, z: 0.65 });
const VIEW_DIR: Vec3 = { x: 0, y: 0, z: -1 };
const HALF_DIR: Vec3 = normalizeVec3({
  x: LIGHT_DIR.x + (-VIEW_DIR.x),
  y: LIGHT_DIR.y + (-VIEW_DIR.y),
  z: LIGHT_DIR.z + (-VIEW_DIR.z),
});

function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function createCubeModel(): Model3D {
  const vertices: Vec3[] = [
    { x: -0.85, y: -0.85, z: 0.85 },
    { x: 0.85, y: -0.85, z: 0.85 },
    { x: 0.85, y: 0.85, z: 0.85 },
    { x: -0.85, y: 0.85, z: 0.85 },
    { x: -0.85, y: -0.85, z: -0.85 },
    { x: 0.85, y: -0.85, z: -0.85 },
    { x: 0.85, y: 0.85, z: -0.85 },
    { x: -0.85, y: 0.85, z: -0.85 },
  ];

  const faces: Face3D[] = [
    { color: '#3b82f6', indices: [0, 1, 2, 3], isMetallic: true, shininess: 32 },
    { color: '#60a5fa', indices: [5, 4, 7, 6], isMetallic: true, shininess: 32 },
    { color: '#2563eb', indices: [4, 0, 3, 7], isMetallic: true, shininess: 32 },
    { color: '#1d4ed8', indices: [1, 5, 6, 2], isMetallic: true, shininess: 32 },
    { color: '#1e40af', indices: [3, 2, 6, 7], isMetallic: true, shininess: 32 },
    { color: '#93c5fd', indices: [4, 5, 1, 0], isMetallic: true, shininess: 32 },
  ];

  return { faces, vertices };
}

function createPyramidModel(): Model3D {
  const vertices: Vec3[] = [
    { x: 0, y: -0.95, z: 0 },
    { x: -0.85, y: 0.85, z: 0.85 },
    { x: 0.85, y: 0.85, z: 0.85 },
    { x: 0.85, y: 0.85, z: -0.85 },
    { x: -0.85, y: 0.85, z: -0.85 },
  ];

  const faces: Face3D[] = [
    { color: '#f59e0b', indices: [0, 1, 2], isMetallic: true, shininess: 48 },
    { color: '#d97706', indices: [0, 2, 3], isMetallic: true, shininess: 48 },
    { color: '#b45309', indices: [0, 3, 4], isMetallic: true, shininess: 48 },
    { color: '#fbbf24', indices: [0, 4, 1], isMetallic: true, shininess: 48 },
    { color: '#92400e', indices: [4, 3, 2, 1], isMetallic: true, shininess: 32 },
  ];

  return { faces, vertices };
}

function createCylinderModel(): Model3D {
  const segments = 24;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle) * 0.85;
    const sin = Math.sin(angle) * 0.85;
    vertices.push({ x: cos, y: -0.85, z: sin });
    vertices.push({ x: cos, y: 0.85, z: sin });
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const top1 = i * 2;
    const bot1 = i * 2 + 1;
    const top2 = next * 2;
    const bot2 = next * 2 + 1;
    const col = i % 2 === 0 ? '#10b981' : '#059669';
    faces.push({ color: col, indices: [top1, top2, bot2, bot1], isMetallic: true, shininess: 36 });
  }

  const topFace: number[] = [];
  const botFace: number[] = [];
  for (let i = 0; i < segments; i++) {
    topFace.push(i * 2);
    botFace.push((segments - 1 - i) * 2 + 1);
  }
  faces.push({ color: '#34d399', indices: topFace, isMetallic: true, shininess: 48 });
  faces.push({ color: '#047857', indices: botFace, isMetallic: true, shininess: 32 });

  return { faces, vertices };
}

function createSphereModel(): Model3D {
  const latBands = 14;
  const longBands = 20;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longBands;
      const x = Math.cos(phi) * sinTheta * 0.9;
      const y = -cosTheta * 0.9;
      const z = Math.sin(phi) * sinTheta * 0.9;
      vertices.push({ x, y, z });
    }
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const first = lat * (longBands + 1) + lon;
      const second = first + longBands + 1;
      const col = (lat + lon) % 2 === 0 ? '#8b5cf6' : '#7c3aed';
      faces.push({ color: col, indices: [first, second, second + 1, first + 1], isMetallic: true, shininess: 48 });
    }
  }

  return { faces, vertices };
}

function createTorusModel(): Model3D {
  const majorSegs = 20;
  const minorSegs = 12;
  const R = 0.65;
  const r = 0.28;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  for (let i = 0; i < majorSegs; i++) {
    const u = (i / majorSegs) * Math.PI * 2;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    for (let j = 0; j < minorSegs; j++) {
      const v = (j / minorSegs) * Math.PI * 2;
      const cosV = Math.cos(v);
      const sinV = Math.sin(v);

      const x = (R + r * cosV) * cosU;
      const y = r * sinV;
      const z = (R + r * cosV) * sinU;
      vertices.push({ x, y, z });
    }
  }

  for (let i = 0; i < majorSegs; i++) {
    const nextI = (i + 1) % majorSegs;
    for (let j = 0; j < minorSegs; j++) {
      const nextJ = (j + 1) % minorSegs;
      const p1 = i * minorSegs + j;
      const p2 = nextI * minorSegs + j;
      const p3 = nextI * minorSegs + nextJ;
      const p4 = i * minorSegs + nextJ;
      const col = (i + j) % 2 === 0 ? '#ec4899' : '#db2777';
      faces.push({ color: col, indices: [p1, p2, p3, p4], isMetallic: true, shininess: 40 });
    }
  }

  return { faces, vertices };
}

function createGlobeModel(): Model3D {
  const latBands = 16;
  const longBands = 24;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];
  const radius = 0.64;

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longBands;
      const x = Math.cos(phi) * sinTheta * radius;
      const y = -cosTheta * radius - 0.1;
      const z = Math.sin(phi) * sinTheta * radius;
      vertices.push({ x, y, z });
    }
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const first = lat * (longBands + 1) + lon;
      const second = first + longBands + 1;
      let color = '#1e40af';
      let isMetallic = true;
      let shininess = 44;

      if (lat <= 1 || lat >= latBands - 2) {
        color = '#f8fafc';
        isMetallic = false;
        shininess = 20;
      } else if (
        (lon >= 4 && lon <= 11 && lat >= 3 && lat <= 8) || // Eurasia
        (lon >= 5 && lon <= 9 && lat >= 8 && lat <= 12) || // Africa
        (lon >= 16 && lon <= 21 && lat >= 3 && lat <= 8) || // North America
        (lon >= 18 && lon <= 22 && lat >= 8 && lat <= 13) || // South America
        (lon >= 8 && lon <= 12 && lat >= 11 && lat <= 13) // Australia
      ) {
        isMetallic = false;
        shininess = 16;
        if (lat === 7 && lon >= 5 && lon <= 8) {
          color = '#eab308'; // Sahara Desert
        } else if (lat >= 10 && lon >= 18 && lon <= 21) {
          color = '#15803d'; // Amazon Rainforest
        } else {
          color = (lat + lon) % 3 === 0 ? '#16a34a' : '#22c55e'; // Green landmass
        }
      } else {
        color = (lat + lon) % 2 === 0 ? '#1d4ed8' : '#2563eb'; // Specular Ocean
      }

      faces.push({ color, indices: [first, second, second + 1, first + 1], isMetallic, shininess });
    }
  }

  // Golden Gimbal Arc (Metallic 24k Gold)
  const armSteps = 16;
  const armStartIdx = vertices.length;
  for (let i = 0; i <= armSteps; i++) {
    const angle = Math.PI * (i / armSteps) - Math.PI / 2;
    const ax = Math.cos(angle) * 0.82;
    const ay = Math.sin(angle) * 0.82 - 0.1;
    vertices.push({ x: ax, y: ay, z: -0.06 });
    vertices.push({ x: ax, y: ay, z: 0.06 });
  }

  for (let i = 0; i < armSteps; i++) {
    const p1 = armStartIdx + i * 2;
    const p2 = armStartIdx + (i + 1) * 2;
    const p3 = armStartIdx + (i + 1) * 2 + 1;
    const p4 = armStartIdx + i * 2 + 1;
    faces.push({ color: '#f59e0b', indices: [p1, p2, p3, p4], isMetallic: true, shininess: 56 });
    faces.push({ color: '#d97706', indices: [p4, p3, p2, p1], isMetallic: true, shininess: 56 });
  }

  // Polished Gold Stand Base
  const baseStartIdx = vertices.length;
  const baseSegs = 14;
  vertices.push({ x: 0, y: 0.72, z: 0 });
  vertices.push({ x: 0, y: 0.92, z: 0 });

  for (let i = 0; i < baseSegs; i++) {
    const ang = (i / baseSegs) * Math.PI * 2;
    const bx = Math.cos(ang) * 0.48;
    const bz = Math.sin(ang) * 0.48;
    vertices.push({ x: bx, y: 0.92, z: bz });
  }

  for (let i = 0; i < baseSegs; i++) {
    const next = (i + 1) % baseSegs;
    const p1 = baseStartIdx;
    const p2 = baseStartIdx + 2 + i;
    const p3 = baseStartIdx + 2 + next;
    faces.push({ color: '#b45309', indices: [p1, p2, p3], isMetallic: true, shininess: 48 });
  }

  return { faces, vertices };
}

function createRocketModel(): Model3D {
  const segments = 16;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  const apexIdx = vertices.length;
  vertices.push({ x: 0, y: -0.92, z: 0 });

  const noseRingIdx = vertices.length;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    vertices.push({ x: Math.cos(ang) * 0.35, y: -0.42, z: Math.sin(ang) * 0.35 });
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push({ color: '#ef4444', indices: [apexIdx, noseRingIdx + i, noseRingIdx + next], isMetallic: true, shininess: 48 });
  }

  const bodyRingIdx = vertices.length;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    vertices.push({ x: Math.cos(ang) * 0.35, y: 0.38, z: Math.sin(ang) * 0.35 });
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const t1 = noseRingIdx + i;
    const t2 = noseRingIdx + next;
    const b1 = bodyRingIdx + i;
    const b2 = bodyRingIdx + next;
    const isPorthole = (i >= 3 && i <= 5);
    const col = isPorthole ? '#06b6d4' : '#f8fafc';
    faces.push({ color: col, indices: [t1, b1, b2, t2], isMetallic: true, shininess: isPorthole ? 64 : 38 });
  }

  const nozzleRingIdx = vertices.length;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    vertices.push({ x: Math.cos(ang) * 0.22, y: 0.65, z: Math.sin(ang) * 0.22 });
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const t1 = bodyRingIdx + i;
    const t2 = bodyRingIdx + next;
    const b1 = nozzleRingIdx + i;
    const b2 = nozzleRingIdx + next;
    faces.push({ color: '#334155', indices: [t1, b1, b2, t2], isMetallic: true, shininess: 40 });
  }

  const nozzleCapIdx = vertices.length;
  vertices.push({ x: 0, y: 0.72, z: 0 });
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push({ color: '#f97316', indices: [nozzleCapIdx, nozzleRingIdx + next, nozzleRingIdx + i], isMetallic: true, shininess: 64 });
  }

  // Aerodynamic swept-back wings (4 fins)
  const finCount = 4;
  for (let f = 0; f < finCount; f++) {
    const ang = (f / finCount) * Math.PI * 2;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    const fTop = vertices.length;
    vertices.push({ x: cos * 0.35, y: 0.05, z: sin * 0.35 });
    const fTip = vertices.length;
    vertices.push({ x: cos * 0.82, y: 0.52, z: sin * 0.82 });
    const fBot = vertices.length;
    vertices.push({ x: cos * 0.35, y: 0.48, z: sin * 0.35 });

    faces.push({ color: '#dc2626', indices: [fTop, fTip, fBot], isMetallic: true, shininess: 48 });
    faces.push({ color: '#b91c1c', indices: [fTop, fBot, fTip], isMetallic: true, shininess: 48 });
  }

  return { faces, vertices };
}

function createDiamondModel(): Model3D {
  const segments = 12;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  const tableIndices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2 + Math.PI / segments;
    vertices.push({ x: Math.cos(ang) * 0.45, y: -0.65, z: Math.sin(ang) * 0.45 });
    tableIndices.push(i);
  }
  faces.push({ color: '#f0f9ff', indices: tableIndices, isMetallic: true, shininess: 64 });

  const girdleStart = vertices.length;
  for (let i = 0; i < segments; i++) {
    const ang = (i / segments) * Math.PI * 2 + Math.PI / segments;
    vertices.push({ x: Math.cos(ang) * 0.88, y: -0.15, z: Math.sin(ang) * 0.88 });
  }

  const crownColors = ['#38bdf8', '#818cf8', '#67e8f9', '#c084fc', '#60a5fa', '#a855f7'];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const t1 = i;
    const t2 = next;
    const g1 = girdleStart + i;
    const g2 = girdleStart + next;
    faces.push({ color: crownColors[i % crownColors.length], indices: [t1, t2, g2, g1], isMetallic: true, shininess: 64 });
  }

  const tipIdx = vertices.length;
  vertices.push({ x: 0, y: 0.85, z: 0 });

  const pavilionColors = ['#0284c7', '#6366f1', '#0ea5e9', '#7c3aed', '#0369a1', '#4f46e5'];
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push({ color: pavilionColors[i % pavilionColors.length], indices: [girdleStart + i, girdleStart + next, tipIdx], isMetallic: true, shininess: 64 });
  }

  return { faces, vertices };
}

function createStarModel(): Model3D {
  const points = 5;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  const rOuter = 0.9;
  const rInner = 0.4;

  const rimIndices: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    vertices.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r, z: 0 });
    rimIndices.push(i);
  }

  const frontApex = vertices.length;
  vertices.push({ x: 0, y: 0, z: -0.32 });
  const backApex = vertices.length;
  vertices.push({ x: 0, y: 0, z: 0.32 });

  const starColors = ['#facc15', '#f59e0b', '#fde047', '#fbbf24', '#eab308'];
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const colFront = starColors[i % starColors.length];
    const colBack = i % 2 === 0 ? '#d97706' : '#b45309';
    faces.push({ color: colFront, indices: [frontApex, i, next], isMetallic: true, shininess: 60 });
    faces.push({ color: colBack, indices: [backApex, next, i], isMetallic: true, shininess: 48 });
  }

  return { faces, vertices };
}

function createHeartModel(): Model3D {
  const steps = 20;
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const sinT = Math.sin(t);
    const x = (16 * Math.pow(sinT, 3)) / 18;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 18 + 0.1;
    vertices.push({ x: x * 0.9, y: y * 0.9, z: 0 });
  }

  const frontApex = vertices.length;
  vertices.push({ x: 0, y: -0.05, z: -0.35 });
  const backApex = vertices.length;
  vertices.push({ x: 0, y: -0.05, z: 0.35 });

  const heartColors = ['#e11d48', '#f43f5e', '#fb7185', '#be123c', '#fda4af', '#f43f5e', '#e11d48', '#be123c'];
  for (let i = 0; i < steps; i++) {
    const next = (i + 1) % steps;
    const colFront = heartColors[i % heartColors.length];
    const colBack = '#9f1239';
    faces.push({ color: colFront, indices: [frontApex, i, next], isMetallic: true, shininess: 44 });
    faces.push({ color: colBack, indices: [backApex, next, i], isMetallic: true, shininess: 32 });
  }

  return { faces, vertices };
}

function createCarModel(): Model3D {
  const vertices: Vec3[] = [
    { x: -0.85, y: 0.05, z: 0.45 },
    { x: 0.85, y: 0.05, z: 0.45 },
    { x: 0.85, y: 0.42, z: 0.45 },
    { x: -0.85, y: 0.42, z: 0.45 },
    { x: -0.85, y: 0.05, z: -0.45 },
    { x: 0.85, y: 0.05, z: -0.45 },
    { x: 0.85, y: 0.42, z: -0.45 },
    { x: -0.85, y: 0.42, z: -0.45 },

    { x: -0.42, y: -0.38, z: 0.38 },
    { x: 0.35, y: -0.38, z: 0.38 },
    { x: 0.58, y: 0.05, z: 0.38 },
    { x: -0.62, y: 0.05, z: 0.38 },
    { x: -0.42, y: -0.38, z: -0.38 },
    { x: 0.35, y: -0.38, z: -0.38 },
    { x: 0.58, y: 0.05, z: -0.38 },
    { x: -0.62, y: 0.05, z: -0.38 },
  ];

  const faces: Face3D[] = [
    { color: '#dc2626', indices: [0, 1, 2, 3], isMetallic: true, shininess: 48 },
    { color: '#b91c1c', indices: [5, 4, 7, 6], isMetallic: true, shininess: 48 },
    { color: '#991b1b', indices: [4, 0, 3, 7], isMetallic: true, shininess: 48 },
    { color: '#ef4444', indices: [1, 5, 6, 2], isMetallic: true, shininess: 48 },
    { color: '#1e293b', indices: [3, 2, 6, 7], isMetallic: false, shininess: 16 },
    { color: '#dc2626', indices: [4, 5, 1, 0], isMetallic: true, shininess: 48 },

    { color: '#7dd3fc', indices: [8, 9, 10, 11], isMetallic: true, shininess: 64 },
    { color: '#7dd3fc', indices: [13, 12, 15, 14], isMetallic: true, shininess: 64 },
    { color: '#b91c1c', indices: [8, 12, 13, 9], isMetallic: true, shininess: 48 },
    { color: '#38bdf8', indices: [9, 13, 14, 10], isMetallic: true, shininess: 64 },
    { color: '#38bdf8', indices: [12, 8, 11, 15], isMetallic: true, shininess: 64 },
  ];

  const wheelPositions = [
    { x: -0.55, y: 0.42, z: 0.48 },
    { x: 0.55, y: 0.42, z: 0.48 },
    { x: -0.55, y: 0.42, z: -0.48 },
    { x: 0.55, y: 0.42, z: -0.48 },
  ];

  for (const wp of wheelPositions) {
    const wStart = vertices.length;
    const wSegs = 8;
    for (let i = 0; i < wSegs; i++) {
      const ang = (i / wSegs) * Math.PI * 2;
      const wx = wp.x + Math.cos(ang) * 0.2;
      const wy = wp.y + Math.sin(ang) * 0.2;
      vertices.push({ x: wx, y: wy, z: wp.z });
    }
    const wFace: number[] = [];
    for (let i = 0; i < wSegs; i++) {
      wFace.push(wStart + (wp.z > 0 ? i : wSegs - 1 - i));
    }
    faces.push({ color: '#1e293b', indices: wFace, isMetallic: false, shininess: 12 });
  }

  return { faces, vertices };
}

function createHouseModel(): Model3D {
  const vertices: Vec3[] = [
    { x: -0.65, y: 0.05, z: 0.65 },
    { x: 0.65, y: 0.05, z: 0.65 },
    { x: 0.65, y: 0.75, z: 0.65 },
    { x: -0.65, y: 0.75, z: 0.65 },
    { x: -0.65, y: 0.05, z: -0.65 },
    { x: 0.65, y: 0.05, z: -0.65 },
    { x: 0.65, y: 0.75, z: -0.65 },
    { x: -0.65, y: 0.75, z: -0.65 },

    { x: -0.72, y: -0.02, z: 0.72 },
    { x: 0.72, y: -0.02, z: 0.72 },
    { x: 0.72, y: -0.02, z: -0.72 },
    { x: -0.72, y: -0.02, z: -0.72 },
    { x: 0, y: -0.75, z: 0.72 },
    { x: 0, y: -0.75, z: -0.72 },

    { x: 0.25, y: -0.78, z: -0.2 },
    { x: 0.45, y: -0.78, z: -0.2 },
    { x: 0.45, y: -0.78, z: 0.0 },
    { x: 0.25, y: -0.78, z: 0.0 },
    { x: 0.25, y: -0.35, z: -0.2 },
    { x: 0.45, y: -0.35, z: -0.2 },
    { x: 0.45, y: -0.35, z: 0.0 },
    { x: 0.25, y: -0.35, z: 0.0 },
  ];

  const faces: Face3D[] = [
    { color: '#fde68a', indices: [0, 1, 2, 3], isMetallic: false, shininess: 16 },
    { color: '#fde68a', indices: [5, 4, 7, 6], isMetallic: false, shininess: 16 },
    { color: '#fef08a', indices: [4, 0, 3, 7], isMetallic: false, shininess: 16 },
    { color: '#fef08a', indices: [1, 5, 6, 2], isMetallic: false, shininess: 16 },
    { color: '#78350f', indices: [3, 2, 6, 7], isMetallic: false, shininess: 16 },

    { color: '#ea580c', indices: [8, 12, 9], isMetallic: false, shininess: 24 },
    { color: '#ea580c', indices: [10, 13, 11], isMetallic: false, shininess: 24 },
    { color: '#c2410c', indices: [8, 11, 13, 12], isMetallic: false, shininess: 24 },
    { color: '#c2410c', indices: [9, 12, 13, 10], isMetallic: false, shininess: 24 },

    { color: '#991b1b', indices: [14, 15, 16, 17], isMetallic: false, shininess: 20 },
    { color: '#7f1d1d', indices: [14, 18, 19, 15], isMetallic: false, shininess: 20 },
    { color: '#7f1d1d', indices: [15, 19, 20, 16], isMetallic: false, shininess: 20 },
    { color: '#7f1d1d', indices: [16, 20, 21, 17], isMetallic: false, shininess: 20 },
    { color: '#7f1d1d', indices: [17, 21, 18, 14], isMetallic: false, shininess: 20 },
  ];

  return { faces, vertices };
}

function createTreeModel(): Model3D {
  const vertices: Vec3[] = [];
  const faces: Face3D[] = [];

  const trunkSegs = 10;
  const trunkStart = vertices.length;
  for (let i = 0; i < trunkSegs; i++) {
    const ang = (i / trunkSegs) * Math.PI * 2;
    vertices.push({ x: Math.cos(ang) * 0.18, y: 0.35, z: Math.sin(ang) * 0.18 });
    vertices.push({ x: Math.cos(ang) * 0.18, y: 0.88, z: Math.sin(ang) * 0.18 });
  }

  for (let i = 0; i < trunkSegs; i++) {
    const next = (i + 1) % trunkSegs;
    const t1 = trunkStart + i * 2;
    const b1 = trunkStart + i * 2 + 1;
    const t2 = trunkStart + next * 2;
    const b2 = trunkStart + next * 2 + 1;
    faces.push({ color: '#78350f', indices: [t1, t2, b2, b1], isMetallic: false, shininess: 12 });
  }

  const tiers = [
    { apexY: -0.15, baseY: 0.45, color: '#15803d', radius: 0.82 },
    { apexY: -0.52, baseY: 0.12, color: '#16a34a', radius: 0.64 },
    { apexY: -0.88, baseY: -0.22, color: '#22c55e', radius: 0.45 },
  ];

  const coneSegs = 12;
  for (const tier of tiers) {
    const apex = vertices.length;
    vertices.push({ x: 0, y: tier.apexY, z: 0 });
    const ring = vertices.length;
    for (let i = 0; i < coneSegs; i++) {
      const ang = (i / coneSegs) * Math.PI * 2;
      vertices.push({ x: Math.cos(ang) * tier.radius, y: tier.baseY, z: Math.sin(ang) * tier.radius });
    }

    for (let i = 0; i < coneSegs; i++) {
      const next = (i + 1) % coneSegs;
      faces.push({ color: tier.color, indices: [apex, ring + i, ring + next], isMetallic: false, shininess: 24 });
    }

    const baseFace: number[] = [];
    for (let i = 0; i < coneSegs; i++) {
      baseFace.push(ring + coneSegs - 1 - i);
    }
    faces.push({ color: '#14532d', indices: baseFace, isMetallic: false, shininess: 16 });
  }

  return { faces, vertices };
}

function createRobotModel(): Model3D {
  const vertices: Vec3[] = [
    { x: -0.55, y: -0.32, z: 0.5 },
    { x: 0.55, y: -0.32, z: 0.5 },
    { x: 0.55, y: 0.55, z: 0.5 },
    { x: -0.55, y: 0.55, z: 0.5 },
    { x: -0.55, y: -0.32, z: -0.5 },
    { x: 0.55, y: -0.32, z: -0.5 },
    { x: 0.55, y: 0.55, z: -0.5 },
    { x: -0.55, y: 0.55, z: -0.5 },

    { x: -0.38, y: -0.15, z: -0.62 },
    { x: 0.38, y: -0.15, z: -0.62 },
    { x: 0.38, y: 0.12, z: -0.62 },
    { x: -0.38, y: 0.12, z: -0.62 },

    { x: -0.72, y: 0.05, z: 0 },
    { x: 0.72, y: 0.05, z: 0 },

    { x: 0, y: -0.65, z: 0 },
    { x: 0, y: -0.85, z: 0 },
  ];

  const faces: Face3D[] = [
    { color: '#94a3b8', indices: [0, 1, 2, 3], isMetallic: true, shininess: 48 },
    { color: '#64748b', indices: [5, 4, 7, 6], isMetallic: true, shininess: 48 },
    { color: '#475569', indices: [4, 0, 3, 7], isMetallic: true, shininess: 48 },
    { color: '#475569', indices: [1, 5, 6, 2], isMetallic: true, shininess: 48 },
    { color: '#334155', indices: [3, 2, 6, 7], isMetallic: true, shininess: 48 },
    { color: '#cbd5e1', indices: [4, 5, 1, 0], isMetallic: true, shininess: 48 },

    { color: '#06b6d4', indices: [8, 9, 10, 11], isMetallic: true, shininess: 64 },
    { color: '#0891b2', indices: [8, 4, 5, 9], isMetallic: true, shininess: 64 },
    { color: '#0891b2', indices: [9, 5, 6, 10], isMetallic: true, shininess: 64 },
    { color: '#0891b2', indices: [10, 6, 7, 11], isMetallic: true, shininess: 64 },
    { color: '#0891b2', indices: [11, 7, 4, 8], isMetallic: true, shininess: 64 },
  ];

  return { faces, vertices };
}

function createBookModel(): Model3D {
  const vertices: Vec3[] = [
    { x: 0, y: -0.65, z: 0.15 },
    { x: 0, y: 0.65, z: 0.15 },
    { x: 0, y: -0.65, z: 0.28 },
    { x: 0, y: 0.65, z: 0.28 },

    { x: -0.78, y: -0.65, z: -0.18 },
    { x: -0.78, y: 0.65, z: -0.18 },
    { x: 0.78, y: -0.65, z: -0.18 },
    { x: 0.78, y: 0.65, z: -0.18 },

    { x: -0.75, y: -0.6, z: -0.12 },
    { x: -0.75, y: 0.6, z: -0.12 },
    { x: 0.75, y: -0.6, z: -0.12 },
    { x: 0.75, y: 0.6, z: -0.12 },
  ];

  const faces: Face3D[] = [
    { color: '#991b1b', indices: [0, 1, 3, 2], isMetallic: false, shininess: 24 },

    { color: '#b91c1c', indices: [4, 0, 1, 5], isMetallic: false, shininess: 24 },
    { color: '#b91c1c', indices: [0, 6, 7, 1], isMetallic: false, shininess: 24 },

    { color: '#fffbeb', indices: [8, 0, 1, 9], isMetallic: false, shininess: 16 },
    { color: '#f8fafc', indices: [0, 10, 11, 1], isMetallic: false, shininess: 16 },

    { color: '#f59e0b', indices: [4, 5, 9, 8], isMetallic: true, shininess: 50 },
    { color: '#f59e0b', indices: [6, 7, 11, 10], isMetallic: true, shininess: 50 },
    { color: '#fef3c7', indices: [4, 8, 0], isMetallic: false, shininess: 20 },
    { color: '#fef3c7', indices: [5, 1, 9], isMetallic: false, shininess: 20 },
    { color: '#fef3c7', indices: [6, 0, 10], isMetallic: false, shininess: 20 },
    { color: '#fef3c7', indices: [7, 11, 1], isMetallic: false, shininess: 20 },
  ];

  return { faces, vertices };
}

const MODEL_CACHE = new Map<Shape3DType, Model3D>();

function getModel(type: Shape3DType): Model3D {
  const custom = getLoadedCustomModel(type);
  if (custom) {
    return custom;
  }
  void loadCustomOBJModel(type);

  if (MODEL_CACHE.has(type)) {
    return MODEL_CACHE.get(type)!;
  }
  let m: Model3D;
  switch (type) {
    case 'globe':
      m = createGlobeModel();
      break;
    case 'rocket':
      m = createRocketModel();
      break;
    case 'diamond':
      m = createDiamondModel();
      break;
    case 'star':
      m = createStarModel();
      break;
    case 'heart':
      m = createHeartModel();
      break;
    case 'car':
      m = createCarModel();
      break;
    case 'house':
      m = createHouseModel();
      break;
    case 'tree':
      m = createTreeModel();
      break;
    case 'robot':
      m = createRobotModel();
      break;
    case 'book':
      m = createBookModel();
      break;
    case 'cube':
      m = createCubeModel();
      break;
    case 'pyramid':
      m = createPyramidModel();
      break;
    case 'cylinder':
      m = createCylinderModel();
      break;
    case 'sphere':
      m = createSphereModel();
      break;
    case 'torus':
      m = createTorusModel();
      break;
    default:
      m = createGlobeModel();
      break;
  }
  MODEL_CACHE.set(type, m);
  return m;
}

function rotateVec3(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const y1 = v.y * cosX - v.z * sinX;
  const z1 = v.y * sinX + v.z * cosX;

  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const x2 = v.x * cosY + z1 * sinY;
  const z2 = -v.x * sinY + z1 * cosY;

  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;

  return { x: x3, y: y3, z: z2 };
}

function parseHexToRgb(hex: string): { b: number; g: number; r: number } {
  if (hex === 'transparent' || !hex.startsWith('#') || hex.length < 7) {
    return { b: 50, g: 50, r: 50 };
  }
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { b, g, r };
}

function calculateStudioLighting(
  baseHex: string,
  normal: Vec3,
  isMetallic = false,
  shininess = 28
): string {
  if (baseHex === 'transparent') return 'transparent';

  const { r, g, b } = parseHexToRgb(baseHex);

  // Diffuse term (N . L)
  const nDotL = Math.max(0, -(normal.x * LIGHT_DIR.x + normal.y * LIGHT_DIR.y + normal.z * LIGHT_DIR.z));
  const diffuseFactor = 0.32 + 0.68 * nDotL;

  // Specular term (N . H)
  const nDotH = Math.max(0, -(normal.x * HALF_DIR.x + normal.y * HALF_DIR.y + normal.z * HALF_DIR.z));
  const specFactor = Math.pow(nDotH, shininess) * (isMetallic ? 0.95 : 0.6);

  // Fresnel rim term (1 - N . V)
  const nDotV = Math.max(0, -normal.z);
  const fresnelFactor = Math.pow(1 - nDotV, 2.8) * 0.35;

  let nr = r * diffuseFactor;
  let ng = g * diffuseFactor;
  let nb = b * diffuseFactor;

  // Specular reflection highlight
  if (isMetallic) {
    nr += r * specFactor * 0.7 + 255 * specFactor * 0.3;
    ng += g * specFactor * 0.7 + 255 * specFactor * 0.3;
    nb += b * specFactor * 0.7 + 255 * specFactor * 0.3;
  } else {
    nr += 255 * specFactor * 0.8;
    ng += 255 * specFactor * 0.8;
    nb += 255 * specFactor * 0.8;
  }

  // Fresnel studio edge sheen
  nr += 220 * fresnelFactor;
  ng += 235 * fresnelFactor;
  nb += 255 * fresnelFactor;

  const finalR = Math.min(255, Math.max(0, Math.round(nr)));
  const finalG = Math.min(255, Math.max(0, Math.round(ng)));
  const finalB = Math.min(255, Math.max(0, Math.round(nb)));

  return `rgb(${finalR}, ${finalG}, ${finalB})`;
}

export function get3DElementProjectedFaces(el: Board3DElement): Projected3DFace[] {
  const model = getModel(el.shape3dType);
  const rx = el.rotationX || 0;
  const ry = el.rotationY || 0;
  const rz = el.rotationZ || 0;

  const transformedVertices = model.vertices.map((v) => rotateVec3(v, rx, ry, rz));

  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const scaleX = (el.width / 2.3);
  const scaleY = (el.height / 2.3);

  const projectedFaces: Projected3DFace[] = [];

  for (const face of model.faces) {
    if (face.indices.length < 3) continue;

    const v0 = transformedVertices[face.indices[0]];
    const v1 = transformedVertices[face.indices[1]];
    const v2 = transformedVertices[face.indices[2]];

    const ab: Vec3 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
    const ac: Vec3 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };

    const nx = ab.y * ac.z - ab.z * ac.y;
    const ny = ab.z * ac.x - ab.x * ac.z;
    const nz = ab.x * ac.y - ab.y * ac.x;

    const normal = normalizeVec3({ x: nx, y: ny, z: nz });

    const doubleSidedShapes: Shape3DType[] = ['torus', 'globe', 'rocket', 'book', 'star', 'heart', 'tree', 'robot', 'car'];
    const isDoubleSided = doubleSidedShapes.includes(el.shape3dType);

    if (!isDoubleSided && normal.z > 0.05) {
      continue;
    }

    let avgZ = 0;
    const pts: BoardPoint[] = [];
    for (const idx of face.indices) {
      const tv = transformedVertices[idx];
      avgZ += tv.z;
      pts.push({
        x: cx + tv.x * scaleX,
        y: cy + tv.y * scaleY,
      });
    }
    avgZ /= face.indices.length;

    let effNormal = normal;
    if (effNormal.z > 0 && isDoubleSided) {
      effNormal = { x: -normal.x, y: -normal.y, z: -normal.z };
    }

    const baseFaceColor = face.color || el.fillColor || '#3b82f6';
    const shadedFaceColor =
      el.shading === false
        ? baseFaceColor
        : calculateStudioLighting(baseFaceColor, effNormal, face.isMetallic ?? false, face.shininess ?? 28);

    projectedFaces.push({
      color: shadedFaceColor,
      depth: avgZ,
      points: pts,
      strokeColor: el.strokeColor || '#1e293b',
      strokeWidth: el.strokeWidth !== undefined ? el.strokeWidth : 1.2,
    });
  }

  projectedFaces.sort((a, b) => b.depth - a.depth);
  return projectedFaces;
}

export function draw3DGroundGrid(
  ctx: CanvasRenderingContext2D,
  el: Board3DElement,
  camera: { zoom: number }
): void {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const scaleX = el.width / 2.3;
  const scaleY = el.height / 2.3;

  const rx = el.rotationX || 0;
  const ry = el.rotationY || 0;
  const rz = el.rotationZ || 0;

  const groundY = 0.95;
  const size = 1.15;
  const cornerRadius = 0.22;
  const steps = 6;

  const perimeter: Vec3[] = [];

  // Top-Right corner
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    perimeter.push({
      x: size - cornerRadius + Math.cos(a) * cornerRadius,
      y: groundY,
      z: -(size - cornerRadius) - Math.sin(a) * cornerRadius,
    });
  }
  // Top-Left corner
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + (i / steps) * (Math.PI / 2);
    perimeter.push({
      x: -(size - cornerRadius) + Math.cos(a) * cornerRadius,
      y: groundY,
      z: -(size - cornerRadius) - Math.sin(a) * cornerRadius,
    });
  }
  // Bottom-Left corner
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * (Math.PI / 2);
    perimeter.push({
      x: -(size - cornerRadius) + Math.cos(a) * cornerRadius,
      y: groundY,
      z: size - cornerRadius - Math.sin(a) * cornerRadius,
    });
  }
  // Bottom-Right corner
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * 3) / 2 + (i / steps) * (Math.PI / 2);
    perimeter.push({
      x: size - cornerRadius + Math.cos(a) * cornerRadius,
      y: groundY,
      z: size - cornerRadius - Math.sin(a) * cornerRadius,
    });
  }

  const projectPoint = (v: Vec3): BoardPoint => {
    const rotated = rotateVec3(v, rx, ry, rz);
    return {
      x: cx + rotated.x * scaleX,
      y: cy + rotated.y * scaleY,
    };
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const projPerimeter = perimeter.map(projectPoint);
  if (projPerimeter.length > 0) {
    ctx.beginPath();
    ctx.moveTo(projPerimeter[0].x, projPerimeter[0].y);
    for (let i = 1; i < projPerimeter.length; i++) {
      ctx.lineTo(projPerimeter[i].x, projPerimeter[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.lineWidth = 1.4 / camera.zoom;
    ctx.stroke();
  }

  const gridDivisions = 4;
  ctx.lineWidth = 1.0 / camera.zoom;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';

  for (let i = 1; i < gridDivisions; i++) {
    if (i === 2) continue;
    const t = -size + (i / gridDivisions) * (size * 2);

    const p1z = projectPoint({ x: t, y: groundY, z: -size });
    const p2z = projectPoint({ x: t, y: groundY, z: size });
    ctx.beginPath();
    ctx.moveTo(p1z.x, p1z.y);
    ctx.lineTo(p2z.x, p2z.y);
    ctx.stroke();

    const p1x = projectPoint({ x: -size, y: groundY, z: t });
    const p2x = projectPoint({ x: size, y: groundY, z: t });
    ctx.beginPath();
    ctx.moveTo(p1x.x, p1x.y);
    ctx.lineTo(p2x.x, p2x.y);
    ctx.stroke();
  }

  ctx.lineWidth = 2.4 / camera.zoom;
  ctx.strokeStyle = 'rgba(139, 61, 255, 0.95)';

  const axisX1 = projectPoint({ x: -size, y: groundY, z: 0 });
  const axisX2 = projectPoint({ x: size, y: groundY, z: 0 });
  ctx.beginPath();
  ctx.moveTo(axisX1.x, axisX1.y);
  ctx.lineTo(axisX2.x, axisX2.y);
  ctx.stroke();

  const axisZ1 = projectPoint({ x: 0, y: groundY, z: -size });
  const axisZ2 = projectPoint({ x: 0, y: groundY, z: size });
  ctx.beginPath();
  ctx.moveTo(axisZ1.x, axisZ1.y);
  ctx.lineTo(axisZ2.x, axisZ2.y);
  ctx.stroke();

  ctx.restore();
}

export function draw3DElement(ctx: CanvasRenderingContext2D, el: Board3DElement): void {
  ctx.save();
  ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Soft ground contact shadow underneath
  const shadowCx = el.x + el.width / 2;
  const shadowCy = el.y + el.height * 0.93;
  const shadowRx = el.width * 0.4;
  const shadowRy = el.height * 0.12;

  const shadowGrad = ctx.createRadialGradient(shadowCx, shadowCy, 0, shadowCx, shadowCy, shadowRx);
  shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.3)');
  shadowGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.12)');
  shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(shadowCx, shadowCy, shadowRx, shadowRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Atmospheric halo glow for Globe/Earth
  if (el.shape3dType === 'globe') {
    const globeCx = el.x + el.width / 2;
    const globeCy = el.y + el.height / 2 - el.height * 0.04;
    const globeR = (el.width / 2.3) * 0.65;
    const atmoGrad = ctx.createRadialGradient(globeCx, globeCy, globeR * 0.85, globeCx, globeCy, globeR * 1.08);
    atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    atmoGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.32)');
    atmoGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = atmoGrad;
    ctx.beginPath();
    ctx.arc(globeCx, globeCy, globeR * 1.08, 0, Math.PI * 2);
    ctx.fill();
  }

  const faces = get3DElementProjectedFaces(el);

  for (const face of faces) {
    if (face.points.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(face.points[0].x, face.points[0].y);
    for (let i = 1; i < face.points.length; i++) {
      ctx.lineTo(face.points[i].x, face.points[i].y);
    }
    ctx.closePath();

    if (face.color !== 'transparent') {
      ctx.fillStyle = face.color;
      ctx.fill();
    }

    if (face.strokeWidth > 0 && face.strokeColor !== 'transparent') {
      ctx.strokeStyle = face.strokeColor;
      ctx.lineWidth = face.strokeWidth;
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function draw3DRotationGizmo(
  ctx: CanvasRenderingContext2D,
  el: Board3DElement,
  camera: { zoom: number }
): void {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const r = 24 / camera.zoom;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(37, 99, 235, 0.18)';
  ctx.fill();

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2 / camera.zoom;
  ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.75, r * 0.35, Math.PI / 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
  ctx.lineWidth = 1.5 / camera.zoom;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 / camera.zoom, 0, Math.PI * 2);
  ctx.fillStyle = '#2563eb';
  ctx.fill();

  ctx.restore();
}

export function hitTest3DRotationGizmo(
  el: BoardElement,
  screenX: number,
  screenY: number,
  worldToScreen: (wx: number, wy: number) => BoardPoint
): boolean {
  if (el.type !== 'shape-3d') return false;
  const centerScreen = worldToScreen(el.x + el.width / 2, el.y + el.height / 2);
  return Math.hypot(screenX - centerScreen.x, screenY - centerScreen.y) <= 26;
}

