import { WebAudioPlaybackEngine } from './audio-engine.js';
import { VideoFrameCache } from './frame-cache.js';
import { MP4Demuxer, MP4FileInfo } from './mp4-demuxer.js';
import { WebCodecsVideoDecoder } from './webcodecs-decoder.js';

interface ClipDecoderInstance {
  decoder: WebCodecsVideoDecoder;
  demuxer: MP4Demuxer;
  fileInfo: MP4FileInfo;
  url: string;
}

export class VideoPlaybackEngine {
  private _isWebCodecsSupported = false;
  private _clipDecoders: Map<string, ClipDecoderInstance> = new Map();
  private _sharedFrameCache: VideoFrameCache = new VideoFrameCache(120);
  private _audioEngine: WebAudioPlaybackEngine = new WebAudioPlaybackEngine();

  constructor() {
    this._isWebCodecsSupported = typeof VideoDecoder !== 'undefined';
  }

  public init(): void {
    this._audioEngine.init();
  }

  public get isWebCodecsSupported(): boolean {
    return this._isWebCodecsSupported;
  }

  public get audioEngine(): WebAudioPlaybackEngine {
    return this._audioEngine;
  }

  public async getFrameForClip(clipId: string, url: string, timeSeconds: number): Promise<VideoFrame | null> {
    if (!this._isWebCodecsSupported) {
      return null;
    }

    try {
      let instance = this._clipDecoders.get(clipId);
      if (!instance || instance.url !== url) {
        if (instance) {
          instance.decoder.destroy();
        }

        const demuxer = new MP4Demuxer(url);
        const fileInfo = await demuxer.parse();
        if (fileInfo.videoTracks.length === 0) {
          return null;
        }

        const videoTrack = fileInfo.videoTracks[0];
        const decoder = new WebCodecsVideoDecoder(demuxer, videoTrack, this._sharedFrameCache);
        const success = await decoder.init();
        if (!success) {
          decoder.destroy();
          return null;
        }

        instance = { decoder, demuxer, fileInfo, url };
        this._clipDecoders.set(clipId, instance);
      }

      return await instance.decoder.getFrameForTime(timeSeconds);
    } catch {
      return null;
    }
  }

  public removeClip(clipId: string): void {
    const instance = this._clipDecoders.get(clipId);
    if (instance) {
      instance.decoder.destroy();
      this._clipDecoders.delete(clipId);
    }
    this._audioEngine.stopClip(clipId);
  }

  public destroy(): void {
    this._clipDecoders.forEach((instance) => {
      instance.decoder.destroy();
    });
    this._clipDecoders.clear();
    this._sharedFrameCache.clear();
    this._audioEngine.destroy();
  }
}
