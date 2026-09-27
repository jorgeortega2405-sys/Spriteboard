export interface ActiveAudioSource {
  clipId: string;
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode;
}

export class WebAudioPlaybackEngine {
  private _context: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _audioBufferCache: Map<string, AudioBuffer> = new Map();
  private _waveformPeaksCache: Map<string, number[]> = new Map();
  private _activeSources: Map<string, ActiveAudioSource> = new Map();
  private _isPlaying = false;
  private _masterVolume = 1;
  private _isMuted = false;

  public init(): boolean {
    if (typeof AudioContext === 'undefined') {
      return false;
    }
    if (!this._context) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this._context = new AudioCtx();
      this._masterGain = this._context.createGain();
      this._masterGain.gain.setValueAtTime(this._isMuted ? 0 : this._masterVolume, this._context.currentTime);
      this._masterGain.connect(this._context.destination);
    }
    return true;
  }

  public async preloadAudio(url: string): Promise<AudioBuffer | null> {
    if (this._audioBufferCache.has(url)) {
      return this._audioBufferCache.get(url)!;
    }
    if (!this._context) {
      this.init();
    }
    if (!this._context) return null;

    try {
      const res = await fetch(url);
      const arrayBuf = await res.arrayBuffer();
      const audioBuffer = await this._context.decodeAudioData(arrayBuf);
      this._audioBufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  public async getAudioWaveformPeaks(url: string, totalBuckets = 300): Promise<number[] | null> {
    if (this._waveformPeaksCache.has(url)) {
      return this._waveformPeaksCache.get(url)!;
    }
    const buffer = await this.preloadAudio(url);
    if (!buffer) return null;

    const channelData = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(channelData.length / totalBuckets));
    const peaks: number[] = [];

    for (let i = 0; i < totalBuckets; i++) {
      const start = i * step;
      const end = Math.min(channelData.length, start + step);
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j += 4) {
        const val = channelData[j];
        sum += val * val;
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sum / count) : 0;
      const amplified = Math.min(1, Math.max(0.05, rms * 3.8));
      peaks.push(amplified);
    }

    this._waveformPeaksCache.set(url, peaks);
    return peaks;
  }

  public async playClip(params: {
    clipId: string;
    duration: number;
    fadeIn?: number;
    fadeOut?: number;
    offset: number;
    url: string;
    volume?: number;
  }): Promise<void> {
    if (!this._context || !this._masterGain) return;
    if (this._context.state === 'suspended') {
      await this._context.resume();
    }

    this.stopClip(params.clipId);

    const buffer = await this.preloadAudio(params.url);
    if (!buffer) return;

    const sourceNode = this._context.createBufferSource();
    sourceNode.buffer = buffer;

    const gainNode = this._context.createGain();
    const clipVol = params.volume !== undefined ? Math.max(0, Math.min(1, params.volume)) : 1;
    const now = this._context.currentTime;

    gainNode.gain.setValueAtTime(0, now);

    if (params.fadeIn && params.fadeIn > 0) {
      gainNode.gain.linearRampToValueAtTime(clipVol, now + params.fadeIn);
    } else {
      gainNode.gain.setValueAtTime(clipVol, now);
    }

    if (params.fadeOut && params.fadeOut > 0 && params.duration > params.fadeOut) {
      const fadeOutStart = now + params.duration - params.fadeOut;
      gainNode.gain.setValueAtTime(clipVol, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, now + params.duration);
    }

    sourceNode.connect(gainNode);
    gainNode.connect(this._masterGain);

    const clampedOffset = Math.max(0, Math.min(params.offset, buffer.duration - 0.05));
    sourceNode.start(now, clampedOffset, params.duration);

    this._activeSources.set(params.clipId, {
      clipId: params.clipId,
      gainNode,
      sourceNode,
    });

    sourceNode.onended = () => {
      if (this._activeSources.get(params.clipId)?.sourceNode === sourceNode) {
        this._activeSources.delete(params.clipId);
      }
    };
  }

  public stopClip(clipId: string): void {
    const active = this._activeSources.get(clipId);
    if (active) {
      try {
        active.sourceNode.stop();
        active.sourceNode.disconnect();
        active.gainNode.disconnect();
      } catch {}
      this._activeSources.delete(clipId);
    }
  }

  public stopAll(): void {
    this._activeSources.forEach((active) => {
      try {
        active.sourceNode.stop();
        active.sourceNode.disconnect();
        active.gainNode.disconnect();
      } catch {}
    });
    this._activeSources.clear();
  }

  public setMasterVolume(vol: number): void {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    if (this._masterGain && this._context) {
      this._masterGain.gain.setValueAtTime(this._isMuted ? 0 : this._masterVolume, this._context.currentTime);
    }
  }

  public setMuted(muted: boolean): void {
    this._isMuted = muted;
    if (this._masterGain && this._context) {
      this._masterGain.gain.setValueAtTime(this._isMuted ? 0 : this._masterVolume, this._context.currentTime);
    }
  }

  public destroy(): void {
    this.stopAll();
    if (this._context && this._context.state !== 'closed') {
      try { this._context.close(); } catch {}
      this._context = null;
    }
    this._audioBufferCache.clear();
    this._waveformPeaksCache.clear();
  }
}
