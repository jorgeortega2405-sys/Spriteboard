import { VideoFrameCache } from './frame-cache.js';
import { MP4Demuxer, MP4Sample, MP4VideoTrack } from './mp4-demuxer.js';

export class WebCodecsVideoDecoder {
  private _demuxer: MP4Demuxer;
  private _track: MP4VideoTrack;
  private _frameCache: VideoFrameCache;
  private _decoder: VideoDecoder | null = null;
  private _lastDecodedIndex = -1;
  private _pendingFrames: Map<number, VideoFrame> = new Map();
  private _isConfigured = false;
  private _isDecoding = false;

  constructor(demuxer: MP4Demuxer, track: MP4VideoTrack, frameCache?: VideoFrameCache) {
    this._demuxer = demuxer;
    this._track = track;
    this._frameCache = frameCache || new VideoFrameCache(90);
  }

  public async init(): Promise<boolean> {
    if (typeof VideoDecoder === 'undefined') {
      return false;
    }

    try {
      const config: VideoDecoderConfig = {
        codec: this._track.codec,
        codedHeight: this._track.height,
        codedWidth: this._track.width,
        description: this._track.description.byteLength > 0 ? this._track.description : undefined,
        hardwareAcceleration: 'prefer-hardware',
      };

      const support = await VideoDecoder.isConfigSupported(config);
      if (!support.supported) {
        return false;
      }

      this._decoder = new VideoDecoder({
        error: () => {
          this._isConfigured = false;
        },
        output: (frame: VideoFrame) => {
          this.onFrameDecoded(frame);
        },
      });

      this._decoder.configure(config);
      this._isConfigured = true;
      return true;
    } catch {
      return false;
    }
  }

  public async getFrameForTime(timeSeconds: number): Promise<VideoFrame | null> {
    if (!this._isConfigured || !this._decoder) {
      return null;
    }

    const target = this._demuxer.getSampleAtTime(this._track, timeSeconds);
    if (!target) return null;

    const cacheKey = `${this._track.trackId}:${target.sampleIndex}`;
    const cached = this._frameCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (this._isDecoding) {
      return this._frameCache.get(cacheKey) || null;
    }

    this._isDecoding = true;
    try {
      const frame = await this.decodeRangeToSample(target.sampleIndex);
      return frame;
    } finally {
      this._isDecoding = false;
    }
  }

  public destroy(): void {
    if (this._decoder) {
      try {
        if (this._decoder.state !== 'closed') {
          this._decoder.reset();
          this._decoder.close();
        }
      } catch {}
      this._decoder = null;
    }
    this._pendingFrames.forEach((f) => {
      try { f.close(); } catch {}
    });
    this._pendingFrames.clear();
    this._frameCache.clear();
    this._isConfigured = false;
  }

  private onFrameDecoded(frame: VideoFrame): void {
    const ptsSeconds = frame.timestamp / 1_000_000;
    const target = this._demuxer.getSampleAtTime(this._track, ptsSeconds);
    if (target) {
      const key = `${this._track.trackId}:${target.sampleIndex}`;
      this._frameCache.set(key, frame);
      this._pendingFrames.set(target.sampleIndex, frame);
    } else {
      frame.close();
    }
  }

  private async decodeRangeToSample(targetIndex: number): Promise<VideoFrame | null> {
    if (!this._decoder) return null;

    let startIndex = 0;
    if (this._lastDecodedIndex >= 0 && this._lastDecodedIndex < targetIndex && (targetIndex - this._lastDecodedIndex) <= 15) {
      startIndex = this._lastDecodedIndex + 1;
    } else {
      startIndex = this._demuxer.getKeyframeIndexBefore(this._track, targetIndex);
      if (this._decoder.state === 'configured') {
        this._decoder.reset();
        this._decoder.configure({
          codec: this._track.codec,
          codedHeight: this._track.height,
          codedWidth: this._track.width,
          description: this._track.description.byteLength > 0 ? this._track.description : undefined,
          hardwareAcceleration: 'prefer-hardware',
        });
      }
    }

    for (let i = startIndex; i <= targetIndex; i++) {
      const sample = this._track.samples[i];
      if (!sample) continue;

      const cacheKey = `${this._track.trackId}:${sample.index}`;
      if (this._frameCache.has(cacheKey) && i < targetIndex) {
        continue;
      }

      const sampleData = await this._demuxer.getSampleData(sample);
      const chunk = new EncodedVideoChunk({
        data: sampleData,
        duration: Math.round(sample.duration * 1_000_000),
        timestamp: Math.round(sample.pts * 1_000_000),
        type: sample.isKeyframe ? 'key' : 'delta',
      });

      this._decoder.decode(chunk);
    }

    await this._decoder.flush();
    this._lastDecodedIndex = targetIndex;

    const targetKey = `${this._track.trackId}:${targetIndex}`;
    return this._frameCache.get(targetKey) || null;
  }
}
