export interface MP4Sample {
  byteLength: number;
  byteOffset: number;
  dts: number;
  duration: number;
  index: number;
  isKeyframe: boolean;
  pts: number;
}

export interface MP4VideoTrack {
  codec: string;
  description: Uint8Array;
  duration: number;
  height: number;
  samples: MP4Sample[];
  timescale: number;
  trackId: number;
  width: number;
}

export interface MP4AudioTrack {
  channelCount: number;
  codec: string;
  description?: Uint8Array;
  duration: number;
  sampleRate: number;
  samples: MP4Sample[];
  timescale: number;
  trackId: number;
}

export interface MP4FileInfo {
  audioTracks: MP4AudioTrack[];
  duration: number;
  timescale: number;
  videoTracks: MP4VideoTrack[];
}

export class MP4Demuxer {
  private _url: string;
  private _fileBuffer: ArrayBuffer | null = null;
  private _fileInfo: MP4FileInfo | null = null;

  constructor(url: string, existingBuffer?: ArrayBuffer) {
    this._url = url;
    if (existingBuffer) {
      this._fileBuffer = existingBuffer;
    }
  }

  public async parse(): Promise<MP4FileInfo> {
    if (this._fileInfo) {
      return this._fileInfo;
    }

    if (!this._fileBuffer) {
      this._fileBuffer = await this.fetchMoovBuffer(this._url);
    }

    const view = new DataView(this._fileBuffer);
    this._fileInfo = this.parseBoxes(view);
    return this._fileInfo;
  }

  public get fileInfo(): MP4FileInfo | null {
    return this._fileInfo;
  }

  public async getSampleData(sample: MP4Sample): Promise<Uint8Array> {
    if (this._fileBuffer && sample.byteOffset + sample.byteLength <= this._fileBuffer.byteLength) {
      return new Uint8Array(this._fileBuffer, sample.byteOffset, sample.byteLength);
    }

    const start = sample.byteOffset;
    const end = sample.byteOffset + sample.byteLength - 1;
    const res = await fetch(this._url, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!res.ok && res.status !== 206) {
      throw new Error(`Failed to fetch sample data range: ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  public getSampleAtTime(track: MP4VideoTrack, timeSeconds: number): { sample: MP4Sample; sampleIndex: number } | null {
    const samples = track.samples;
    if (samples.length === 0) return null;

    let low = 0;
    let high = samples.length - 1;
    let found = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const s = samples[mid];
      if (s.pts <= timeSeconds) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return { sample: samples[found], sampleIndex: found };
  }

  public getKeyframeIndexBefore(track: MP4VideoTrack, sampleIndex: number): number {
    const samples = track.samples;
    for (let i = Math.min(sampleIndex, samples.length - 1); i >= 0; i--) {
      if (samples[i].isKeyframe) {
        return i;
      }
    }
    return 0;
  }

  private async fetchMoovBuffer(url: string): Promise<ArrayBuffer> {
    const initialHeaderRes = await fetch(url, {
      headers: { Range: 'bytes=0-131071' },
    });

    if (!initialHeaderRes.ok && initialHeaderRes.status !== 206) {
      const fullRes = await fetch(url);
      return await fullRes.arrayBuffer();
    }

    const initialBuf = await initialHeaderRes.arrayBuffer();
    const moovOffset = this.findMoovAtomOffset(new DataView(initialBuf));

    if (moovOffset !== null) {
      if (moovOffset.offset + moovOffset.size <= initialBuf.byteLength) {
        return initialBuf;
      }
      const end = moovOffset.offset + moovOffset.size - 1;
      const moovRes = await fetch(url, {
        headers: { Range: `bytes=${moovOffset.offset}-${end}` },
      });
      const moovBuf = await moovRes.arrayBuffer();
      const combined = new Uint8Array(moovOffset.offset + moovOffset.size);
      combined.set(new Uint8Array(initialBuf.slice(0, moovOffset.offset)), 0);
      combined.set(new Uint8Array(moovBuf), moovOffset.offset);
      return combined.buffer;
    }

    const fullRes = await fetch(url);
    return await fullRes.arrayBuffer();
  }

  private findMoovAtomOffset(view: DataView): { offset: number; size: number } | null {
    let offset = 0;
    const len = view.byteLength;
    while (offset + 8 <= len) {
      const size = view.getUint32(offset);
      const type = this.readString(view, offset + 4, 4);
      const realSize = size === 1 ? Number(view.getBigUint64(offset + 8)) : size;
      if (type === 'moov') {
        return { offset, size: realSize };
      }
      if (realSize <= 0) break;
      offset += realSize;
    }
    return null;
  }

  private parseBoxes(view: DataView): MP4FileInfo {
    let offset = 0;
    const totalLength = view.byteLength;
    let movieTimescale = 1000;
    let movieDuration = 0;
    const videoTracks: MP4VideoTrack[] = [];
    const audioTracks: MP4AudioTrack[] = [];

    while (offset + 8 <= totalLength) {
      const boxSize = view.getUint32(offset);
      const boxType = this.readString(view, offset + 4, 4);
      const headerSize = boxSize === 1 ? 16 : 8;
      const realSize = boxSize === 1 ? Number(view.getBigUint64(offset + 8)) : boxSize;
      const end = realSize === 0 ? totalLength : offset + realSize;

      if (boxType === 'moov') {
        let moovPos = offset + headerSize;
        while (moovPos + 8 <= end) {
          const subSize = view.getUint32(moovPos);
          const subType = this.readString(view, moovPos + 4, 4);
          const subHeaderSize = subSize === 1 ? 16 : 8;
          const subRealSize = subSize === 1 ? Number(view.getBigUint64(moovPos + 8)) : subSize;
          const subEnd = subRealSize === 0 ? end : moovPos + subRealSize;

          if (subType === 'mvhd') {
            const version = view.getUint8(moovPos + subHeaderSize);
            const tsOffset = version === 1 ? moovPos + subHeaderSize + 20 : moovPos + subHeaderSize + 12;
            movieTimescale = view.getUint32(tsOffset);
            movieDuration = version === 1 ? Number(view.getBigUint64(tsOffset + 4)) : view.getUint32(tsOffset + 4);
          } else if (subType === 'trak') {
            const track = this.parseTrack(view, moovPos + subHeaderSize, subEnd);
            if (track) {
              if (track.type === 'video') {
                videoTracks.push(track.data as MP4VideoTrack);
              } else if (track.type === 'audio') {
                audioTracks.push(track.data as MP4AudioTrack);
              }
            }
          }

          if (subRealSize <= 0) break;
          moovPos += subRealSize;
        }
      }

      if (realSize <= 0) break;
      offset += realSize;
    }

    return {
      audioTracks,
      duration: movieTimescale > 0 ? movieDuration / movieTimescale : 0,
      timescale: movieTimescale,
      videoTracks,
    };
  }

  private parseTrack(view: DataView, start: number, end: number): { data: MP4VideoTrack | MP4AudioTrack; type: 'audio' | 'video' } | null {
    let pos = start;
    let trackId = 0;
    let width = 0;
    let height = 0;
    let handlerType = '';
    let mediaTimescale = 1000;
    let mediaDuration = 0;
    let codec = '';
    let description: Uint8Array = new Uint8Array(0);
    let channelCount = 2;
    let sampleRate = 44100;

    let stts: { count: number; delta: number }[] = [];
    let ctts: { count: number; offset: number }[] = [];
    let stss: Set<number> | null = null;
    let stsc: { firstChunk: number; samplesPerChunk: number }[] = [];
    let stsz: number[] = [];
    let defaultSampleSize = 0;
    let sampleCount = 0;
    let stco: number[] = [];

    while (pos + 8 <= end) {
      const boxSize = view.getUint32(pos);
      const boxType = this.readString(view, pos + 4, 4);
      const headerSize = boxSize === 1 ? 16 : 8;
      const realSize = boxSize === 1 ? Number(view.getBigUint64(pos + 8)) : boxSize;
      const boxEnd = realSize === 0 ? end : pos + realSize;

      if (boxType === 'tkhd') {
        const version = view.getUint8(pos + headerSize);
        const idOffset = version === 1 ? pos + headerSize + 20 : pos + headerSize + 12;
        trackId = view.getUint32(idOffset);
        const wOffset = boxEnd - 8;
        width = view.getUint32(wOffset) >>> 16;
        height = view.getUint32(wOffset + 4) >>> 16;
      } else if (boxType === 'mdia') {
        let mdiaPos = pos + headerSize;
        while (mdiaPos + 8 <= boxEnd) {
          const mSize = view.getUint32(mdiaPos);
          const mType = this.readString(view, mdiaPos + 4, 4);
          const mHeader = mSize === 1 ? 16 : 8;
          const mRealSize = mSize === 1 ? Number(view.getBigUint64(mdiaPos + 8)) : mSize;
          const mEnd = mRealSize === 0 ? boxEnd : mdiaPos + mRealSize;

          if (mType === 'mdhd') {
            const v = view.getUint8(mdiaPos + mHeader);
            const tsOff = v === 1 ? mdiaPos + mHeader + 20 : mdiaPos + mHeader + 12;
            mediaTimescale = view.getUint32(tsOff);
            mediaDuration = v === 1 ? Number(view.getBigUint64(tsOff + 4)) : view.getUint32(tsOff + 4);
          } else if (mType === 'hdlr') {
            handlerType = this.readString(view, mdiaPos + mHeader + 8, 4);
          } else if (mType === 'minf') {
            let minfPos = mdiaPos + mHeader;
            while (minfPos + 8 <= mEnd) {
              const miSize = view.getUint32(minfPos);
              const miType = this.readString(view, minfPos + 4, 4);
              const miHeader = miSize === 1 ? 16 : 8;
              const miRealSize = miSize === 1 ? Number(view.getBigUint64(minfPos + 8)) : miSize;
              const miEnd = miRealSize === 0 ? mEnd : minfPos + miRealSize;

              if (miType === 'stbl') {
                let stblPos = minfPos + miHeader;
                while (stblPos + 8 <= miEnd) {
                  const sSize = view.getUint32(stblPos);
                  const sType = this.readString(view, stblPos + 4, 4);
                  const sHeader = sSize === 1 ? 16 : 8;
                  const sRealSize = sSize === 1 ? Number(view.getBigUint64(stblPos + 8)) : sSize;
                  const sEnd = sRealSize === 0 ? miEnd : stblPos + sRealSize;

                  if (sType === 'stsd') {
                    const stsdData = this.parseStsd(view, stblPos + sHeader + 4, sEnd, handlerType);
                    codec = stsdData.codec;
                    description = stsdData.description;
                    if (stsdData.width > 0) width = stsdData.width;
                    if (stsdData.height > 0) height = stsdData.height;
                    channelCount = stsdData.channelCount;
                    sampleRate = stsdData.sampleRate;
                  } else if (sType === 'stts') {
                    stts = this.parseStts(view, stblPos + sHeader);
                  } else if (sType === 'ctts') {
                    ctts = this.parseCtts(view, stblPos + sHeader);
                  } else if (sType === 'stss') {
                    stss = this.parseStss(view, stblPos + sHeader);
                  } else if (sType === 'stsc') {
                    stsc = this.parseStsc(view, stblPos + sHeader);
                  } else if (sType === 'stsz') {
                    const parsedStsz = this.parseStsz(view, stblPos + sHeader);
                    defaultSampleSize = parsedStsz.defaultSize;
                    sampleCount = parsedStsz.count;
                    stsz = parsedStsz.sizes;
                  } else if (sType === 'stco') {
                    stco = this.parseStco(view, stblPos + sHeader);
                  } else if (sType === 'co64') {
                    stco = this.parseCo64(view, stblPos + sHeader);
                  }

                  if (sRealSize <= 0) break;
                  stblPos += sRealSize;
                }
              }

              if (miRealSize <= 0) break;
              minfPos += miRealSize;
            }
          }

          if (mRealSize <= 0) break;
          mdiaPos += mRealSize;
        }
      }

      if (realSize <= 0) break;
      pos += realSize;
    }

    if (!handlerType || (!codec && handlerType === 'vide')) return null;

    const samples = this.buildSamples({
      ctts,
      defaultSampleSize,
      mediaTimescale,
      sampleCount,
      stco,
      stsc,
      stss,
      stsz,
      stts,
    });

    if (handlerType === 'vide') {
      const vTrack: MP4VideoTrack = {
        codec,
        description,
        duration: mediaTimescale > 0 ? mediaDuration / mediaTimescale : 0,
        height,
        samples,
        timescale: mediaTimescale,
        trackId,
        width,
      };
      return { data: vTrack, type: 'video' };
    }

    if (handlerType === 'soun') {
      const aTrack: MP4AudioTrack = {
        channelCount,
        codec,
        description,
        duration: mediaTimescale > 0 ? mediaDuration / mediaTimescale : 0,
        sampleRate,
        samples,
        timescale: mediaTimescale,
        trackId,
      };
      return { data: aTrack, type: 'audio' };
    }

    return null;
  }

  private parseStsd(
    view: DataView,
    start: number,
    end: number,
    handlerType: string
  ): { channelCount: number; codec: string; description: Uint8Array; height: number; sampleRate: number; width: number } {
    let pos = start + 4;
    let codec = '';
    let description: Uint8Array = new Uint8Array(0);
    let width = 0;
    let height = 0;
    let channelCount = 2;
    let sampleRate = 44100;

    if (pos + 8 <= end) {
      const entrySize = view.getUint32(pos);
      const entryFormat = this.readString(view, pos + 4, 4);
      codec = entryFormat;

      if (handlerType === 'vide') {
        width = view.getUint16(pos + 32);
        height = view.getUint16(pos + 34);

        let subPos = pos + 86;
        while (subPos + 8 <= pos + entrySize) {
          const subBoxSize = view.getUint32(subPos);
          const subBoxType = this.readString(view, subPos + 4, 4);
          if (subBoxType === 'avcC') {
            const rawDesc = this.readBytes(view, subPos + 8, subBoxSize - 8);
            description = rawDesc;
            if (rawDesc.length >= 4) {
              const profile = rawDesc[1].toString(16).padStart(2, '0');
              const compat = rawDesc[2].toString(16).padStart(2, '0');
              const level = rawDesc[3].toString(16).padStart(2, '0');
              codec = `avc1.${profile}${compat}${level}`;
            }
            break;
          } else if (subBoxType === 'hvcC') {
            description = this.readBytes(view, subPos + 8, subBoxSize - 8);
            codec = 'hvc1.1.6.L93.B0';
            break;
          } else if (subBoxType === 'vpcC') {
            description = this.readBytes(view, subPos + 8, subBoxSize - 8);
            codec = 'vp09.00.10.08';
            break;
          }
          if (subBoxSize <= 0) break;
          subPos += subBoxSize;
        }
      } else if (handlerType === 'soun') {
        channelCount = view.getUint16(pos + 24);
        sampleRate = view.getUint32(pos + 32) >>> 16;
        if (entryFormat === 'mp4a') {
          codec = 'mp4a.40.2';
        }
      }
    }

    return { channelCount, codec, description, height, sampleRate, width };
  }

  private parseStts(view: DataView, offset: number): { count: number; delta: number }[] {
    const entryCount = view.getUint32(offset + 4);
    const result: { count: number; delta: number }[] = [];
    let pos = offset + 8;
    for (let i = 0; i < entryCount; i++) {
      const count = view.getUint32(pos);
      const delta = view.getUint32(pos + 4);
      result.push({ count, delta });
      pos += 8;
    }
    return result;
  }

  private parseCtts(view: DataView, offset: number): { count: number; offset: number }[] {
    const entryCount = view.getUint32(offset + 4);
    const result: { count: number; offset: number }[] = [];
    let pos = offset + 8;
    for (let i = 0; i < entryCount; i++) {
      const count = view.getUint32(pos);
      const sampleOffset = view.getInt32(pos + 4);
      result.push({ count, offset: sampleOffset });
      pos += 8;
    }
    return result;
  }

  private parseStss(view: DataView, offset: number): Set<number> {
    const entryCount = view.getUint32(offset + 4);
    const set = new Set<number>();
    let pos = offset + 8;
    for (let i = 0; i < entryCount; i++) {
      set.add(view.getUint32(pos));
      pos += 4;
    }
    return set;
  }

  private parseStsc(view: DataView, offset: number): { firstChunk: number; samplesPerChunk: number }[] {
    const entryCount = view.getUint32(offset + 4);
    const result: { firstChunk: number; samplesPerChunk: number }[] = [];
    let pos = offset + 8;
    for (let i = 0; i < entryCount; i++) {
      const firstChunk = view.getUint32(pos);
      const samplesPerChunk = view.getUint32(pos + 4);
      result.push({ firstChunk, samplesPerChunk });
      pos += 12;
    }
    return result;
  }

  private parseStsz(view: DataView, offset: number): { count: number; defaultSize: number; sizes: number[] } {
    const defaultSize = view.getUint32(offset + 4);
    const count = view.getUint32(offset + 8);
    const sizes: number[] = [];
    if (defaultSize === 0) {
      let pos = offset + 12;
      for (let i = 0; i < count; i++) {
        sizes.push(view.getUint32(pos));
        pos += 4;
      }
    }
    return { count, defaultSize, sizes };
  }

  private parseStco(view: DataView, offset: number): number[] {
    const count = view.getUint32(offset + 4);
    const offsets: number[] = [];
    let pos = offset + 8;
    for (let i = 0; i < count; i++) {
      offsets.push(view.getUint32(pos));
      pos += 4;
    }
    return offsets;
  }

  private parseCo64(view: DataView, offset: number): number[] {
    const count = view.getUint32(offset + 4);
    const offsets: number[] = [];
    let pos = offset + 8;
    for (let i = 0; i < count; i++) {
      offsets.push(Number(view.getBigUint64(pos)));
      pos += 8;
    }
    return offsets;
  }

  private buildSamples(params: {
    ctts: { count: number; offset: number }[];
    defaultSampleSize: number;
    mediaTimescale: number;
    sampleCount: number;
    stco: number[];
    stsc: { firstChunk: number; samplesPerChunk: number }[];
    stss: Set<number> | null;
    stsz: number[];
    stts: { count: number; delta: number }[];
  }): MP4Sample[] {
    const { ctts, defaultSampleSize, mediaTimescale, sampleCount, stco, stsc, stss, stsz, stts } = params;

    const totalSamples = defaultSampleSize === 0 ? stsz.length : sampleCount;
    if (totalSamples === 0) return [];

    const durations: number[] = [];
    for (const entry of stts) {
      for (let j = 0; j < entry.count; j++) {
        durations.push(entry.delta);
      }
    }

    const cttsOffsets: number[] = [];
    if (ctts.length > 0) {
      for (const entry of ctts) {
        for (let j = 0; j < entry.count; j++) {
          cttsOffsets.push(entry.offset);
        }
      }
    }

    const chunkOffsets = stco;
    const chunkSampleCounts: number[] = [];
    for (let i = 0; i < chunkOffsets.length; i++) {
      const chunkIdx = i + 1;
      let spc = 1;
      for (let j = stsc.length - 1; j >= 0; j--) {
        if (chunkIdx >= stsc[j].firstChunk) {
          spc = stsc[j].samplesPerChunk;
          break;
        }
      }
      chunkSampleCounts.push(spc);
    }

    const samples: MP4Sample[] = [];
    let currentDts = 0;
    let sampleIdx = 0;

    for (let c = 0; c < chunkOffsets.length; c++) {
      let offsetInChunk = chunkOffsets[c];
      const count = chunkSampleCounts[c];

      for (let s = 0; s < count; s++) {
        if (sampleIdx >= totalSamples) break;

        const size = defaultSampleSize > 0 ? defaultSampleSize : (stsz[sampleIdx] || 0);
        const delta = durations[sampleIdx] || (durations.length > 0 ? durations[durations.length - 1] : 1000);
        const cttsOff = cttsOffsets[sampleIdx] || 0;
        const pts = currentDts + cttsOff;

        const isKeyframe = stss ? stss.has(sampleIdx + 1) : true;

        samples.push({
          byteLength: size,
          byteOffset: offsetInChunk,
          dts: mediaTimescale > 0 ? currentDts / mediaTimescale : 0,
          duration: mediaTimescale > 0 ? delta / mediaTimescale : 0,
          index: sampleIdx,
          isKeyframe,
          pts: mediaTimescale > 0 ? pts / mediaTimescale : 0,
        });

        offsetInChunk += size;
        currentDts += delta;
        sampleIdx++;
      }
    }

    return samples;
  }

  private readString(view: DataView, offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(view.getUint8(offset + i));
    }
    return result;
  }

  private readBytes(view: DataView, offset: number, length: number): Uint8Array {
    const len = Math.max(0, length);
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = view.getUint8(offset + i);
    }
    return bytes;
  }
}
