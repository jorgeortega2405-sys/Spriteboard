import { logger } from './logger.service.js';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface RenderJob {
  createdAt: number;
  downloadPath?: string;
  error?: string;
  id: string;
  outputFilename: string;
  progress: number;
  status: 'completed' | 'failed' | 'processing' | 'queued';
  userId?: number;
}

const renderJobs: Map<string, RenderJob> = new Map();
const EXPORTS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'exports');

async function ensureExportsDir(): Promise<void> {
  try {
    await fs.promises.mkdir(EXPORTS_DIR, { recursive: true });
  } catch {}
}

function cleanupOldExports(): void {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000;

  for (const [id, job] of renderJobs.entries()) {
    if (now - job.createdAt > maxAge) {
      renderJobs.delete(id);
    }
  }

  void fs.promises.readdir(EXPORTS_DIR).then((files) => {
    files.forEach((file) => {
      const filePath = path.join(EXPORTS_DIR, file);
      void fs.promises.stat(filePath).then((stat) => {
        if (now - stat.mtimeMs > maxAge) {
          void fs.promises.unlink(filePath).catch(() => {});
        }
      }).catch(() => {});
    });
  }).catch(() => {});
}

setInterval(cleanupOldExports, 30 * 60 * 1000);

export function getRenderJob(jobId: string): RenderJob | undefined {
  return renderJobs.get(jobId);
}

function resolveLocalPath(assetUrl?: string): string | null {
  if (!assetUrl) return null;
  const cleanUrl = assetUrl.split('?')[0];

  if (cleanUrl.includes('/uploads/')) {
    const relativePart = cleanUrl.substring(cleanUrl.indexOf('/uploads/'));
    const fullPath = path.resolve(process.cwd(), 'public', relativePart.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  if (fs.existsSync(cleanUrl)) {
    return cleanUrl;
  }

  return null;
}

export async function createVideoExportJob(
  project: any,
  options: { fps?: number; format?: string; height?: number; name?: string; quality?: string; width?: number },
  userId?: number
): Promise<string> {
  await ensureExportsDir();
  cleanupOldExports();

  const jobId = `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const safeName = (project.name || 'video').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const outputFilename = `${safeName}_${jobId.substring(4, 10)}.mp4`;
  const outputPath = path.join(EXPORTS_DIR, outputFilename);

  const job: RenderJob = {
    createdAt: Date.now(),
    id: jobId,
    outputFilename,
    progress: 0,
    status: 'queued',
    userId,
  };
  renderJobs.set(jobId, job);

  void processRenderJob(jobId, project, options, outputPath);

  return jobId;
}

async function processRenderJob(
  jobId: string,
  project: any,
  options: { fps?: number; format?: string; height?: number; name?: string; quality?: string; width?: number },
  outputPath: string
): Promise<void> {
  const job = renderJobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.progress = 5;

  const width = options.width || project.width || 1920;
  const height = options.height || project.height || 1080;
  const fps = options.fps || project.fps || 30;
  const duration = Math.max(1, Math.min(3600, project.duration || 30));
  const bgColor = (project.background?.color || '#000000').replace('#', '0x');

  const videoClips: any[] = [];
  const audioClips: any[] = [];
  const textClips: any[] = [];

  if (Array.isArray(project.tracks)) {
    for (const track of project.tracks) {
      if (track.hidden) continue;
      if (Array.isArray(track.clips)) {
        for (const clip of track.clips) {
          const localPath = resolveLocalPath(clip.assetUrl);
          if (clip.mediaType === 'video' || clip.mediaType === 'image') {
            if (localPath) {
              videoClips.push({ ...clip, isTrackMuted: track.muted, localPath });
            }
          } else if (clip.mediaType === 'audio') {
            if (localPath) {
              audioClips.push({ ...clip, isTrackMuted: track.muted, localPath });
            }
          } else if (clip.mediaType === 'text' && clip.textConfig?.text) {
            textClips.push(clip);
          }
        }
      }
    }
  }

  const inputs: string[] = [];
  const filterComplex: string[] = [];
  let inputIndex = 0;

  filterComplex.push(`color=c=${bgColor}:s=${width}x${height}:d=${duration}:r=${fps}[base0]`);
  let currentBase = 'base0';

  const audioLabels: string[] = [];

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const isImage = clip.mediaType === 'image';

    if (isImage) {
      inputs.push('-loop', '1', '-i', clip.localPath);
    } else {
      inputs.push('-i', clip.localPath);
    }

    const inIdx = inputIndex++;
    const trimStart = Math.max(0, clip.trimStart || 0);
    const clipDur = Math.max(0.1, clip.duration || 5);
    const trimEnd = trimStart + clipDur;
    const startTime = Math.max(0, clip.startTime || 0);
    const endTime = startTime + clipDur;

    const vFilterParts: string[] = [];
    if (!isImage) {
      vFilterParts.push(`trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS`);
    } else {
      vFilterParts.push(`trim=duration=${clipDur},setpts=PTS-STARTPTS`);
    }

    vFilterParts.push(`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${bgColor},setsar=1`);

    if (clip.filters) {
      const f = clip.filters;
      if (f.preset === 'grayscale' || f.grayscale === 1) {
        vFilterParts.push('hue=s=0');
      } else if (f.preset === 'retro' || f.sepia) {
        vFilterParts.push('colorbalance=rs=0.39:gs=0.76:bs=0.18:rm=0.34:gm=0.68:bm=0.16');
      } else if (f.preset === 'cinema') {
        vFilterParts.push('eq=contrast=1.15:saturation=1.2:brightness=-0.02');
      } else if (f.preset === 'warm') {
        vFilterParts.push('colorbalance=rs=0.1:gs=0.05:bs=-0.1');
      } else if (f.preset === 'cool') {
        vFilterParts.push('colorbalance=rs=-0.1:gs=0.0:bs=0.15');
      }

      if (f.brightness !== undefined && f.brightness !== 1) {
        vFilterParts.push(`eq=brightness=${(f.brightness - 1).toFixed(2)}`);
      }
      if (f.contrast !== undefined && f.contrast !== 1) {
        vFilterParts.push(`eq=contrast=${f.contrast.toFixed(2)}`);
      }
      if (f.saturate !== undefined && f.saturate !== 1) {
        vFilterParts.push(`eq=saturation=${f.saturate.toFixed(2)}`);
      }
    }

    if (clip.transition && clip.transition.type !== 'none' && clip.transition.duration > 0) {
      const transDur = Math.min(clipDur / 2, clip.transition.duration);
      if (clip.transition.type === 'fade_black') {
        vFilterParts.push(`fade=t=in:st=0:d=${transDur.toFixed(2)}`);
      } else {
        vFilterParts.push(`fade=t=in:st=0:d=${transDur.toFixed(2)}:alpha=1`);
      }
    }

    const vLabel = `v${i}`;
    const nextBase = `base${i + 1}`;

    filterComplex.push(`[${inIdx}:v]${vFilterParts.join(',')}[${vLabel}]`);
    filterComplex.push(`[${currentBase}][${vLabel}]overlay=x=0:y=0:enable='between(t,${startTime},${endTime})'[${nextBase}]`);
    currentBase = nextBase;

    if (!isImage && !clip.isTrackMuted && !clip.muted) {
      const aLabel = `va${i}`;
      const startTimeMs = Math.round(startTime * 1000);
      const aFilterParts: string[] = [
        `atrim=start=${trimStart}:end=${trimEnd}`,
        'asetpts=PTS-STARTPTS',
        'aformat=channel_layouts=stereo',
      ];

      if (clip.audioFadeIn && clip.audioFadeIn > 0) {
        aFilterParts.push(`afade=t=in:st=0:d=${clip.audioFadeIn.toFixed(2)}`);
      }
      if (clip.audioFadeOut && clip.audioFadeOut > 0) {
        const fadeOutStart = Math.max(0, clipDur - clip.audioFadeOut);
        aFilterParts.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${clip.audioFadeOut.toFixed(2)}`);
      }

      aFilterParts.push(`volume=${(clip.volume ?? 1).toFixed(2)}`);
      aFilterParts.push(`adelay=${startTimeMs}|${startTimeMs}`);

      filterComplex.push(`[${inIdx}:a]${aFilterParts.join(',')}[${aLabel}]`);
      audioLabels.push(`[${aLabel}]`);
    }
  }

  for (let k = 0; k < textClips.length; k++) {
    const tClip = textClips[k];
    const textStr = (tClip.textConfig.text || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/%/g, '\\%');
    if (!textStr) continue;

    const fontSize = Math.max(16, Math.min(120, tClip.textConfig.fontSize || 40));
    const fontColor = (tClip.textConfig.color || '#ffffff').replace('#', '0x');
    const tStart = Math.max(0, tClip.startTime || 0);
    const tEnd = tStart + Math.max(0.1, tClip.duration || 2);
    const nextBase = `tbase${k + 1}`;

    const drawTextFilter = `drawtext=text='${textStr}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=(h-text_h)*0.85:shadowcolor=black:shadowx=2:shadowy=2:enable='between(t,${tStart},${tEnd})'`;

    filterComplex.push(`[${currentBase}]${drawTextFilter}[${nextBase}]`);
    currentBase = nextBase;
  }

  for (let j = 0; j < audioClips.length; j++) {
    const aClip = audioClips[j];
    if (aClip.isTrackMuted || aClip.muted) continue;

    inputs.push('-i', aClip.localPath);
    const inIdx = inputIndex++;

    const trimStart = Math.max(0, aClip.trimStart || 0);
    const aDur = Math.max(0.1, aClip.duration || 5);
    const trimEnd = trimStart + aDur;
    const startTimeMs = Math.round(Math.max(0, aClip.startTime || 0) * 1000);
    const aLabel = `aud${j}`;

    const aFilterParts: string[] = [
      `atrim=start=${trimStart}:end=${trimEnd}`,
      'asetpts=PTS-STARTPTS',
      'aformat=channel_layouts=stereo',
    ];

    if (aClip.audioFadeIn && aClip.audioFadeIn > 0) {
      aFilterParts.push(`afade=t=in:st=0:d=${aClip.audioFadeIn.toFixed(2)}`);
    }
    if (aClip.audioFadeOut && aClip.audioFadeOut > 0) {
      const fadeOutStart = Math.max(0, aDur - aClip.audioFadeOut);
      aFilterParts.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${aClip.audioFadeOut.toFixed(2)}`);
    }

    aFilterParts.push(`volume=${(aClip.volume ?? 1).toFixed(2)}`);
    aFilterParts.push(`adelay=${startTimeMs}|${startTimeMs}`);

    filterComplex.push(`[${inIdx}:a]${aFilterParts.join(',')}[${aLabel}]`);
    audioLabels.push(`[${aLabel}]`);
  }

  let audioMap = '-an';
  if (audioLabels.length > 0) {
    if (audioLabels.length === 1) {
      audioMap = audioLabels[0];
    } else {
      filterComplex.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0:normalize=0[aout]`);
      audioMap = '[aout]';
    }
  }

  const args: string[] = [
    '-y',
    ...inputs,
    '-filter_complex', filterComplex.join(';'),
    '-map', `[${currentBase}]`,
  ];

  if (audioMap !== '-an') {
    args.push('-map', audioMap);
    args.push('-c:a', 'aac', '-b:a', '192k');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-t', String(duration),
    '-movflags', '+faststart',
    '-progress', 'pipe:1',
    outputPath
  );

  try {
    const ffmpegProc = spawn('ffmpeg', args);

    ffmpegProc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/out_time_ms=(\d+)/);
      if (match) {
        const outTimeUs = parseInt(match[1], 10);
        const currentSec = outTimeUs / 1000000;
        const pct = Math.min(95, Math.round((currentSec / duration) * 90) + 5);
        job.progress = pct;
      }
    });

    ffmpegProc.stderr.on('data', (_chunk: Buffer) => {});

    await new Promise<void>((resolve, reject) => {
      ffmpegProc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg finalizó con código de salida ${code}`));
        }
      });
      ffmpegProc.on('error', (err) => {
        reject(err);
      });
    });

    job.status = 'completed';
    job.progress = 100;
    job.downloadPath = `/uploads/exports/${path.basename(outputPath)}`;
    logger.app.info('Video exportado con éxito', { duration, jobId, outputPath });
  } catch (err: any) {
    job.status = 'failed';
    job.error = 'No se pudo renderizar el video. Por favor intenta de nuevo.';
    logger.app.error('Error al ejecutar FFmpeg en render service', {
      error: err?.message,
      jobId,
    });
  }
}
