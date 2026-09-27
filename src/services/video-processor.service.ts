import { logger } from './logger.service.js';
import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  bitrateKbps?: number;
  codec?: string;
  duration: number;
  format: string;
  height: number;
  width: number;
}

export interface VideoProcessingResult {
  duration: number;
  height: number;
  mimeType: string;
  size: number;
  thumbnailBuffer: Buffer;
  thumbnailExtension: string;
  thumbnailMimeType: string;
  width: number;
}

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  'video/ogg',
]);

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-pn-wav',
  'audio/x-wav',
]);

export function isVideoMime(mimeType: string): boolean {
  if (!mimeType) return false;
  const clean = mimeType.toLowerCase().split(';')[0].trim();
  return ALLOWED_VIDEO_MIMES.has(clean);
}

export function isAudioMime(mimeType: string): boolean {
  if (!mimeType) return false;
  const clean = mimeType.toLowerCase().split(';')[0].trim();
  return ALLOWED_AUDIO_MIMES.has(clean);
}

export function detectMediaKind(mimeType: string, filename = ''): 'audio' | 'image' | 'video' {
  if (isVideoMime(mimeType)) return 'video';
  if (isAudioMime(mimeType)) return 'audio';
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.ogv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) return 'audio';
  return 'image';
}

async function runFfprobe(filePath: string): Promise<VideoMetadata> {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration,format_name,bit_rate:stream=width,height,codec_name,codec_type,duration',
    '-of', 'json',
    filePath,
  ];

  const { stdout } = await execFileAsync('ffprobe', args, { timeout: 15000 });
  const data = JSON.parse(stdout);

  let width = 0;
  let height = 0;
  let duration = 0;
  let codec = '';
  let format = data.format?.format_name || '';

  if (Array.isArray(data.streams)) {
    const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
    if (videoStream) {
      width = Number(videoStream.width) || 0;
      height = Number(videoStream.height) || 0;
      codec = String(videoStream.codec_name || '');
      if (videoStream.duration) {
        duration = parseFloat(videoStream.duration) || 0;
      }
    }
  }

  if (duration <= 0 && data.format?.duration) {
    duration = parseFloat(data.format.duration) || 0;
  }

  const bitrateKbps = data.format?.bit_rate ? Math.round(Number(data.format.bit_rate) / 1000) : undefined;

  return {
    bitrateKbps,
    codec,
    duration: Math.max(0, duration),
    format,
    height,
    width,
  };
}

async function extractVideoThumbnail(filePath: string, duration: number): Promise<Buffer> {
  const seekTime = duration > 1 ? Math.min(1.0, duration / 2).toFixed(2) : '0.00';
  const args = [
    '-ss', seekTime,
    '-i', filePath,
    '-vframes', '1',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-',
  ];

  const { stdout } = await execFileAsync('ffmpeg', args, {
    encoding: 'buffer',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 15000,
  });

  const rawBuffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  return await sharp(rawBuffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}

function generateDefaultThumbnail(width = 640, height = 360, label = 'Video'): Promise<Buffer> {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <circle cx="${width / 2}" cy="${height / 2}" r="36" fill="rgba(255,255,255,0.2)"/>
      <polygon points="${width / 2 - 10},${height / 2 - 18} ${width / 2 + 18},${height / 2} ${width / 2 - 10},${height / 2 + 18}" fill="#ffffff"/>
      <text x="${width / 2}" y="${height / 2 + 60}" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">${label}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

export async function processVideo(
  videoBuffer: Buffer,
  originalFilename: string,
  declaredMimeType: string
): Promise<VideoProcessingResult> {
  const tempDir = path.join(os.tmpdir(), 'spriteboard-video-tmp');
  await fs.promises.mkdir(tempDir, { recursive: true });

  const rawExt = path.extname(originalFilename).toLowerCase() || '.mp4';
  const tempFile = path.join(tempDir, `vid_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${rawExt}`);

  try {
    await fs.promises.writeFile(tempFile, videoBuffer);

    let metadata: VideoMetadata = { duration: 0, format: 'mp4', height: 720, width: 1280 };
    let thumbnailBuffer: Buffer | null = null;

    try {
      metadata = await runFfprobe(tempFile);
    } catch (probeErr: any) {
      logger.app.warn('Ffprobe no pudo inspeccionar video, usando valores de respaldo', {
        error: probeErr?.message,
        filename: originalFilename,
      });
    }

    try {
      thumbnailBuffer = await extractVideoThumbnail(tempFile, metadata.duration);
    } catch (thumbErr: any) {
      logger.app.warn('Ffmpeg no pudo generar miniatura para video, generando portada por defecto', {
        error: thumbErr?.message,
        filename: originalFilename,
      });
      thumbnailBuffer = await generateDefaultThumbnail(metadata.width || 640, metadata.height || 360, originalFilename);
    }

    return {
      duration: metadata.duration,
      height: metadata.height || 720,
      mimeType: declaredMimeType || 'video/mp4',
      size: videoBuffer.length,
      thumbnailBuffer: thumbnailBuffer || (await generateDefaultThumbnail(640, 360, originalFilename)),
      thumbnailExtension: 'webp',
      thumbnailMimeType: 'image/webp',
      width: metadata.width || 1280,
    };
  } finally {
    try {
      await fs.promises.unlink(tempFile);
    } catch {}
  }
}

export function generateAudioThumbnail(label = 'Audio'): Promise<Buffer> {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#18181b"/>
          <stop offset="100%" stop-color="#09090b"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <circle cx="320" cy="160" r="48" fill="rgba(99, 102, 241, 0.2)"/>
      <path d="M312 135 v42 a14 14 0 1 1 -8 -12.6 v-35.4 l28 -6 v30 a14 14 0 1 1 -8 -12.6 v-23.4 z" fill="#818cf8"/>
      <path d="M220 250 h12 v20 h-12 z M240 240 h12 v30 h-12 z M260 230 h12 v40 h-12 z M280 220 h12 v50 h-12 z M300 210 h12 v60 h-12 z M320 205 h12 v65 h-12 z M340 215 h12 v55 h-12 z M360 225 h12 v45 h-12 z M380 235 h12 v35 h-12 z M400 245 h12 v25 h-12 z" fill="#6366f1" opacity="0.6"/>
      <text x="320" y="315" fill="#a1a1aa" font-family="sans-serif" font-size="16" font-weight="600" text-anchor="middle">${label.slice(0, 40)}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

export async function processAudio(
  audioBuffer: Buffer,
  originalFilename: string,
  declaredMimeType: string
): Promise<VideoProcessingResult> {
  const tempDir = path.join(os.tmpdir(), 'spriteboard-audio-tmp');
  await fs.promises.mkdir(tempDir, { recursive: true });

  const rawExt = path.extname(originalFilename).toLowerCase() || '.mp3';
  const tempFile = path.join(tempDir, `aud_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${rawExt}`);

  try {
    await fs.promises.writeFile(tempFile, audioBuffer);

    let metadata: VideoMetadata = { duration: 0, format: 'mp3', height: 0, width: 0 };
    try {
      metadata = await runFfprobe(tempFile);
    } catch (probeErr: any) {
      logger.app.warn('Ffprobe no pudo inspeccionar audio, usando valores de respaldo', {
        error: probeErr?.message,
        filename: originalFilename,
      });
    }

    const thumbnailBuffer = await generateAudioThumbnail(originalFilename);

    return {
      duration: metadata.duration,
      height: 0,
      mimeType: declaredMimeType || 'audio/mpeg',
      size: audioBuffer.length,
      thumbnailBuffer,
      thumbnailExtension: 'webp',
      thumbnailMimeType: 'image/webp',
      width: 0,
    };
  } finally {
    try {
      await fs.promises.unlink(tempFile);
    } catch {}
  }
}
