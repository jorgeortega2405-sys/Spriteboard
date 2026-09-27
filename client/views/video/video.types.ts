export type VideoMediaType = 'audio' | 'image' | 'text' | 'video';

export type VideoTrackType = 'audio' | 'overlay' | 'video';

export interface VideoTransform {
  fit?: 'contain' | 'cover' | 'stretch';
  height?: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  width?: number;
  x?: number;
  y?: number;
}

export interface VideoTextConfig {
  backgroundColor?: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  text: string;
  textAlign?: 'center' | 'left' | 'right';
}

export interface VideoFilters {
  brightness?: number;
  contrast?: number;
  grayscale?: number;
  hueRotate?: number;
  preset?: 'cinema' | 'cool' | 'grayscale' | 'none' | 'retro' | 'warm';
  saturate?: number;
  sepia?: number;
}

export interface VideoTransition {
  duration: number;
  type: 'crossfade' | 'fade_black' | 'none' | 'slide_left' | 'wipe_left';
}

export interface VideoClip {
  assetUrl?: string;
  audioFadeIn?: number;
  audioFadeOut?: number;
  duration: number;
  filters?: VideoFilters;
  id: string;
  mediaType: VideoMediaType;
  muted?: boolean;
  name: string;
  sourceDuration: number;
  speed?: number;
  startTime: number;
  textConfig?: VideoTextConfig;
  thumbnailUrl?: string;
  transform?: VideoTransform;
  transition?: VideoTransition;
  trimEnd: number;
  trimStart: number;
  volume: number;
  waveformPeaks?: number[];
}

export interface VideoTrack {
  clips: VideoClip[];
  hidden?: boolean;
  id: string;
  locked?: boolean;
  muted?: boolean;
  name: string;
  type: VideoTrackType;
  volume?: number;
}

export interface VideoBackground {
  color: string;
  type: 'solid' | 'transparent';
}

export interface VideoFormatPreset {
  aspect: string;
  category: 'horizontal' | 'square' | 'vertical';
  description: string;
  height: number;
  id: string;
  name: string;
  width: number;
}

export interface VideoProject {
  background: VideoBackground;
  currentTime?: number;
  duration: number;
  fps: number;
  height: number;
  name: string;
  presetId?: string;
  tracks: VideoTrack[];
  type: 'video';
  version: number;
  width: number;
  zoom?: number;
}

export interface ExportOptions {
  fps: number;
  format: 'mp4';
  height: number;
  name?: string;
  quality: 'high' | 'low' | 'medium';
  width: number;
}

export interface ExportJobStatus {
  downloadUrl?: string;
  error?: string;
  jobId: string;
  progress: number;
  status: 'completed' | 'failed' | 'processing' | 'queued';
}
