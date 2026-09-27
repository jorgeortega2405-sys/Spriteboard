export class VideoFrameCache {
  private _maxSize: number;
  private _cache: Map<string, VideoFrame> = new Map();

  constructor(maxSize = 60) {
    this._maxSize = maxSize;
  }

  public get(key: string): VideoFrame | null {
    const frame = this._cache.get(key);
    if (!frame) return null;
    this._cache.delete(key);
    this._cache.set(key, frame);
    return frame;
  }

  public has(key: string): boolean {
    return this._cache.has(key);
  }

  public set(key: string, frame: VideoFrame): void {
    if (this._cache.has(key)) {
      const existing = this._cache.get(key);
      if (existing && existing !== frame) {
        try { existing.close(); } catch {}
      }
      this._cache.delete(key);
    } else if (this._cache.size >= this._maxSize) {
      const oldestKey = this._cache.keys().next().value;
      if (oldestKey) {
        const oldestFrame = this._cache.get(oldestKey);
        if (oldestFrame) {
          try { oldestFrame.close(); } catch {}
        }
        this._cache.delete(oldestKey);
      }
    }
    this._cache.set(key, frame);
  }

  public clear(): void {
    this._cache.forEach((frame) => {
      try { frame.close(); } catch {}
    });
    this._cache.clear();
  }

  public get size(): number {
    return this._cache.size;
  }
}
