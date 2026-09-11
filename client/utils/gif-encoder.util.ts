export interface GifFrameInput {
  canvas: HTMLCanvasElement;
  delayMs: number;
}

class ByteStream {
  private buffer: Uint8Array;
  private length = 0;

  constructor(initialCapacity = 65536) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  public writeByte(b: number): void {
    this.ensureCapacity(1);
    this.buffer[this.length++] = b & 0xff;
  }

  public writeBytes(arr: ArrayLike<number>): void {
    this.ensureCapacity(arr.length);
    for (let i = 0; i < arr.length; i++) {
      this.buffer[this.length++] = arr[i] & 0xff;
    }
  }

  public writeShort(v: number): void {
    this.writeByte(v & 0xff);
    this.writeByte((v >> 8) & 0xff);
  }

  public writeString(str: string): void {
    for (let i = 0; i < str.length; i++) {
      this.writeByte(str.charCodeAt(i));
    }
  }

  public toBlob(mimeType = 'image/gif'): Blob {
    return new Blob([this.buffer.buffer.slice(0, this.length) as ArrayBuffer], { type: mimeType });
  }

  private ensureCapacity(needed: number): void {
    if (this.length + needed > this.buffer.length) {
      let newCap = Math.max(this.buffer.length * 2, this.length + needed + 65536);
      const next = new Uint8Array(newCap);
      next.set(this.buffer);
      this.buffer = next;
    }
  }
}

class LzwEncoder {
  private remainingBits = 0;
  private bitBuffer = 0;
  private currentBlock = new Uint8Array(256);
  private blockLength = 0;
  private stream: ByteStream;

  constructor(stream: ByteStream) {
    this.stream = stream;
  }

  public encode(pixels: Uint8Array, minCodeSize: number): void {
    this.stream.writeByte(minCodeSize);

    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let maxCode = (1 << codeSize) - 1;

    const prefixTable = new Int32Array(5003).fill(-1);
    const suffixTable = new Int32Array(5003).fill(-1);
    const codeTable = new Int32Array(5003).fill(-1);

    const resetTable = () => {
      prefixTable.fill(-1);
      suffixTable.fill(-1);
      codeTable.fill(-1);
    };

    let nextCode = endCode + 1;
    this.writeCode(clearCode, codeSize);

    if (pixels.length === 0) {
      this.writeCode(endCode, codeSize);
      this.flushBits();
      return;
    }

    let currentPrefix = pixels[0];

    for (let i = 1; i < pixels.length; i++) {
      const c = pixels[i];
      let hash = ((c << 8) ^ currentPrefix) % 5003;
      if (hash < 0) hash += 5003;

      let step = 1;
      let foundIndex = -1;

      while (prefixTable[hash] !== -1) {
        if (prefixTable[hash] === currentPrefix && suffixTable[hash] === c) {
          foundIndex = hash;
          break;
        }
        hash = (hash + step) % 5003;
        step++;
      }

      if (foundIndex !== -1) {
        currentPrefix = codeTable[foundIndex];
      } else {
        this.writeCode(currentPrefix, codeSize);

        if (nextCode < 4096) {
          prefixTable[hash] = currentPrefix;
          suffixTable[hash] = c;
          codeTable[hash] = nextCode++;

          if (nextCode > maxCode && codeSize < 12) {
            codeSize++;
            maxCode = (1 << codeSize) - 1;
          }
        } else {
          this.writeCode(clearCode, codeSize);
          resetTable();
          codeSize = minCodeSize + 1;
          maxCode = (1 << codeSize) - 1;
          nextCode = endCode + 1;
        }

        currentPrefix = c;
      }
    }

    this.writeCode(currentPrefix, codeSize);
    this.writeCode(endCode, codeSize);
    this.flushBits();
  }

  private writeCode(code: number, size: number): void {
    this.bitBuffer |= (code << this.remainingBits);
    this.remainingBits += size;

    while (this.remainingBits >= 8) {
      this.currentBlock[this.blockLength++] = this.bitBuffer & 0xff;
      this.bitBuffer >>= 8;
      this.remainingBits -= 8;

      if (this.blockLength === 254) {
        this.flushBlock();
      }
    }
  }

  private flushBits(): void {
    if (this.remainingBits > 0) {
      this.currentBlock[this.blockLength++] = this.bitBuffer & 0xff;
      this.bitBuffer = 0;
      this.remainingBits = 0;
    }
    this.flushBlock();
    this.stream.writeByte(0);
  }

  private flushBlock(): void {
    if (this.blockLength > 0) {
      this.stream.writeByte(this.blockLength);
      for (let i = 0; i < this.blockLength; i++) {
        this.stream.writeByte(this.currentBlock[i]);
      }
      this.blockLength = 0;
    }
  }
}

function buildFramePalette(rgba: Uint8ClampedArray): {
  indexedPixels: Uint8Array;
  palette: number[];
  transparentIndex: number;
} {
  const colorMap = new Map<number, number>();
  const palette: number[] = [];
  let transparentIndex = -1;

  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 128) {
      if (transparentIndex === -1) {
        transparentIndex = palette.length;
        palette.push(0x000000);
      }
    } else {
      const rgb = ((rgba[i] & 0xf8) << 16) | ((rgba[i + 1] & 0xfc) << 8) | (rgba[i + 2] & 0xf8);
      if (!colorMap.has(rgb)) {
        if (palette.length < 256) {
          const idx = palette.length;
          colorMap.set(rgb, idx);
          palette.push(((rgba[i]) << 16) | ((rgba[i + 1]) << 8) | rgba[i + 2]);
        }
      }
    }
  }

  if (palette.length === 0) {
    palette.push(0x000000);
  }

  const pixelCount = rgba.length / 4;
  const indexedPixels = new Uint8Array(pixelCount);

  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const a = rgba[i + 3];
    if (a < 128) {
      indexedPixels[p] = transparentIndex !== -1 ? transparentIndex : 0;
    } else {
      const rgb = ((rgba[i] & 0xf8) << 16) | ((rgba[i + 1] & 0xfc) << 8) | (rgba[i + 2] & 0xf8);
      const mapped = colorMap.get(rgb);
      if (mapped !== undefined) {
        indexedPixels[p] = mapped;
      } else {
        let bestIdx = transparentIndex === 0 ? 1 : 0;
        let bestDist = Infinity;
        const r = rgba[i];
        const g = rgba[i + 1];
        const b = rgba[i + 2];

        for (let j = 0; j < palette.length; j++) {
          if (j === transparentIndex) continue;
          const pr = (palette[j] >> 16) & 0xff;
          const pg = (palette[j] >> 8) & 0xff;
          const pb = palette[j] & 0xff;
          const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = j;
          }
        }
        indexedPixels[p] = bestIdx;
      }
    }
  }

  return { indexedPixels, palette, transparentIndex };
}

export async function encodeFramesToGif(frames: GifFrameInput[]): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No hay fotogramas para exportar.');
  }

  const width = frames[0].canvas.width;
  const height = frames[0].canvas.height;
  const stream = new ByteStream();

  stream.writeString('GIF89a');
  stream.writeShort(width);
  stream.writeShort(height);
  stream.writeByte(0x70);
  stream.writeByte(0);
  stream.writeByte(0);

  stream.writeByte(0x21);
  stream.writeByte(0xff);
  stream.writeByte(0x0b);
  stream.writeString('NETSCAPE2.0');
  stream.writeByte(0x03);
  stream.writeByte(0x01);
  stream.writeShort(0);
  stream.writeByte(0x00);

  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f];
    const ctx = frame.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    const imageData = ctx.getImageData(0, 0, width, height);
    const { indexedPixels, palette, transparentIndex } = buildFramePalette(imageData.data);

    let power = 1;
    while ((1 << power) < palette.length && power < 8) {
      power++;
    }
    const colorCount = 1 << power;

    const delayHundreds = Math.max(2, Math.round((frame.delayMs || 125) / 10));
    stream.writeByte(0x21);
    stream.writeByte(0xf9);
    stream.writeByte(0x04);

    const hasTransparency = transparentIndex !== -1;
    const packedFields = 0x08 | (hasTransparency ? 0x01 : 0x00);
    stream.writeByte(packedFields);
    stream.writeShort(delayHundreds);
    stream.writeByte(hasTransparency ? transparentIndex : 0);
    stream.writeByte(0x00);

    stream.writeByte(0x2c);
    stream.writeShort(0);
    stream.writeShort(0);
    stream.writeShort(width);
    stream.writeShort(height);
    stream.writeByte(0x80 | (power - 1));

    for (let c = 0; c < colorCount; c++) {
      if (c < palette.length) {
        stream.writeByte((palette[c] >> 16) & 0xff);
        stream.writeByte((palette[c] >> 8) & 0xff);
        stream.writeByte(palette[c] & 0xff);
      } else {
        stream.writeByte(0);
        stream.writeByte(0);
        stream.writeByte(0);
      }
    }

    const minCodeSize = Math.max(2, power);
    const lzw = new LzwEncoder(stream);
    lzw.encode(indexedPixels, minCodeSize);
  }

  stream.writeByte(0x3b);
  return stream.toBlob('image/gif');
}
