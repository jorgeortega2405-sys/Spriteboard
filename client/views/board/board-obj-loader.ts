import { Shape3DType } from './board.types.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Face3D {
  color?: string;
  indices: number[];
  isMetallic?: boolean;
  shininess?: number;
}

export interface Model3D {
  faces: Face3D[];
  vertices: Vec3[];
}

const CUSTOM_MODEL_CACHE = new Map<string, Model3D>();
const LOADING_STATUS = new Map<string, 'failed' | 'loaded' | 'pending'>();
const LOAD_LISTENERS: Array<(shape: string) => void> = [];

const MATERIAL_COLOR_MAP: Record<string, { color: string; isMetallic?: boolean; shininess?: number }> = {
  amber: { color: '#f59e0b', isMetallic: true, shininess: 48 },
  black: { color: '#1e293b', isMetallic: false, shininess: 16 },
  blue: { color: '#2563eb', isMetallic: false, shininess: 32 },
  brass: { color: '#d97706', isMetallic: true, shininess: 44 },
  bronze: { color: '#b45309', isMetallic: true, shininess: 40 },
  brown: { color: '#78350f', isMetallic: false, shininess: 12 },
  chrome: { color: '#cbd5e1', isMetallic: true, shininess: 64 },
  copper: { color: '#ea580c', isMetallic: true, shininess: 42 },
  cyan: { color: '#06b6d4', isMetallic: false, shininess: 40 },
  dark: { color: '#0f172a', isMetallic: false, shininess: 16 },
  diamond: { color: '#38bdf8', isMetallic: true, shininess: 60 },
  emerald: { color: '#059669', isMetallic: true, shininess: 50 },
  glass: { color: '#7dd3fc', isMetallic: false, shininess: 55 },
  gold: { color: '#fbbf24', isMetallic: true, shininess: 52 },
  gray: { color: '#64748b', isMetallic: false, shininess: 24 },
  green: { color: '#16a34a', isMetallic: false, shininess: 24 },
  iron: { color: '#475569', isMetallic: true, shininess: 36 },
  leather: { color: '#92400e', isMetallic: false, shininess: 18 },
  light: { color: '#f8fafc', isMetallic: false, shininess: 28 },
  metal: { color: '#94a3b8', isMetallic: true, shininess: 48 },
  neon: { color: '#22d3ee', isMetallic: false, shininess: 50 },
  orange: { color: '#f97316', isMetallic: false, shininess: 28 },
  pink: { color: '#f43f5e', isMetallic: false, shininess: 32 },
  purple: { color: '#8b3dff', isMetallic: false, shininess: 36 },
  red: { color: '#dc2626', isMetallic: false, shininess: 30 },
  rubber: { color: '#0f172a', isMetallic: false, shininess: 10 },
  ruby: { color: '#e11d48', isMetallic: true, shininess: 56 },
  silver: { color: '#e2e8f0', isMetallic: true, shininess: 54 },
  steel: { color: '#94a3b8', isMetallic: true, shininess: 46 },
  titanium: { color: '#64748b', isMetallic: true, shininess: 48 },
  water: { color: '#0284c7', isMetallic: false, shininess: 45 },
  white: { color: '#f8fafc', isMetallic: false, shininess: 32 },
  wood: { color: '#854d0e', isMetallic: false, shininess: 14 },
  yellow: { color: '#facc15', isMetallic: true, shininess: 40 },
};

function resolveMaterialProps(matName: string): { color?: string; isMetallic?: boolean; shininess?: number } {
  const cleanName = matName.toLowerCase().trim();
  const hexMatch = cleanName.match(/(?:#|col_|mat_)?([0-9a-f]{6})\b/);
  if (hexMatch) {
    return { color: `#${hexMatch[1]}`, isMetallic: false, shininess: 28 };
  }

  for (const [keyword, props] of Object.entries(MATERIAL_COLOR_MAP)) {
    if (cleanName.includes(keyword)) {
      return props;
    }
  }

  return {};
}

export function parseOBJ(objText: string): Model3D {
  const rawVertices: Vec3[] = [];
  const vertexColors: string[] = [];
  const faces: Face3D[] = [];

  let currentMaterial: { color?: string; isMetallic?: boolean; shininess?: number } = {};

  const lines = objText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'v') {
      const x = parseFloat(parts[1]) || 0;
      const y = parseFloat(parts[2]) || 0;
      const z = parseFloat(parts[3]) || 0;
      rawVertices.push({ x, y, z });

      if (parts.length >= 7) {
        let r = parseFloat(parts[4]) || 0;
        let g = parseFloat(parts[5]) || 0;
        let b = parseFloat(parts[6]) || 0;
        if (r <= 1 && g <= 1 && b <= 1 && (r > 0 || g > 0 || b > 0)) {
          r = Math.round(r * 255);
          g = Math.round(g * 255);
          b = Math.round(b * 255);
        }
        vertexColors.push(`rgb(${r}, ${g}, ${b})`);
      }
    } else if (cmd === 'usemtl') {
      const matName = parts.slice(1).join(' ');
      currentMaterial = resolveMaterialProps(matName);
    } else if (cmd === 'f') {
      const faceIndices: number[] = [];
      for (let i = 1; i < parts.length; i++) {
        const seg = parts[i].split('/')[0];
        if (!seg) continue;
        const vIdx = parseInt(seg, 10);
        if (isNaN(vIdx)) continue;
        const resolvedIdx = vIdx < 0 ? rawVertices.length + vIdx : vIdx - 1;
        if (resolvedIdx >= 0 && resolvedIdx < rawVertices.length) {
          faceIndices.push(resolvedIdx);
        }
      }

      if (faceIndices.length < 3) continue;

      let faceColor = currentMaterial.color;
      if (!faceColor && vertexColors.length === rawVertices.length && faceIndices.length > 0) {
        faceColor = vertexColors[faceIndices[0]];
      }

      if (faceIndices.length === 3) {
        faces.push({
          color: faceColor,
          indices: faceIndices,
          isMetallic: currentMaterial.isMetallic,
          shininess: currentMaterial.shininess,
        });
      } else if (faceIndices.length === 4) {
        faces.push({
          color: faceColor,
          indices: [faceIndices[0], faceIndices[1], faceIndices[2]],
          isMetallic: currentMaterial.isMetallic,
          shininess: currentMaterial.shininess,
        });
        faces.push({
          color: faceColor,
          indices: [faceIndices[0], faceIndices[2], faceIndices[3]],
          isMetallic: currentMaterial.isMetallic,
          shininess: currentMaterial.shininess,
        });
      } else {
        for (let i = 1; i < faceIndices.length - 1; i++) {
          faces.push({
            color: faceColor,
            indices: [faceIndices[0], faceIndices[i], faceIndices[i + 1]],
            isMetallic: currentMaterial.isMetallic,
            shininess: currentMaterial.shininess,
          });
        }
      }
    }
  }

  if (rawVertices.length === 0) {
    return { faces: [], vertices: [] };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const v of rawVertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const maxSpan = Math.max(spanX, spanY, spanZ) || 1;

  const targetSize = 1.7;
  const scale = targetSize / maxSpan;

  const normalizedVertices: Vec3[] = rawVertices.map((v) => ({
    x: (v.x - cx) * scale,
    y: -(v.y - cy) * scale,
    z: (v.z - cz) * scale,
  }));

  return { faces, vertices: normalizedVertices };
}

export function onCustomModelLoaded(listener: (shape: string) => void): () => void {
  LOAD_LISTENERS.push(listener);
  return () => {
    const idx = LOAD_LISTENERS.indexOf(listener);
    if (idx !== -1) LOAD_LISTENERS.splice(idx, 1);
  };
}

function notifyModelLoaded(shape: string): void {
  for (const listener of LOAD_LISTENERS) {
    listener(shape);
  }
}

export function getLoadedCustomModel(shape: string): Model3D | undefined {
  return CUSTOM_MODEL_CACHE.get(shape);
}

export async function loadCustomOBJModel(shape: string): Promise<Model3D | null> {
  if (CUSTOM_MODEL_CACHE.has(shape)) {
    return CUSTOM_MODEL_CACHE.get(shape)!;
  }

  const status = LOADING_STATUS.get(shape);
  if (status === 'pending' || status === 'failed') {
    return null;
  }

  LOADING_STATUS.set(shape, 'pending');

  try {
    const res = await fetch(`/models/3d/${shape}.obj`);
    if (!res.ok) {
      LOADING_STATUS.set(shape, 'failed');
      return null;
    }

    const text = await res.text();
    if (!text || (!text.includes('v ') && !text.includes('f '))) {
      LOADING_STATUS.set(shape, 'failed');
      return null;
    }

    const parsedModel = parseOBJ(text);
    if (parsedModel.vertices.length === 0 || parsedModel.faces.length === 0) {
      LOADING_STATUS.set(shape, 'failed');
      return null;
    }

    CUSTOM_MODEL_CACHE.set(shape, parsedModel);
    LOADING_STATUS.set(shape, 'loaded');
    notifyModelLoaded(shape);
    return parsedModel;
  } catch {
    LOADING_STATUS.set(shape, 'failed');
    return null;
  }
}

export function preloadCustom3DModels(shapes: Shape3DType[]): void {
  for (const shape of shapes) {
    void loadCustomOBJModel(shape);
  }
}
