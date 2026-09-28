export interface ZipFileInput {
  data: Uint8Array | Blob | string;
  name: string;
}

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ (data[i] ?? 0)) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(d = new Date()): { date: number; time: number } {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);
  const time = (hours << 11) | (minutes << 5) | seconds;

  const year = Math.max(0, d.getFullYear() - 1980);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const date = (year << 9) | (month << 5) | day;

  return { date, time };
}

async function fileDataToUint8Array(data: Uint8Array | Blob | string): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  if (data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  return new Uint8Array(0);
}

export async function createZipBlob(files: ZipFileInput[]): Promise<Blob> {
  const utf8Encoder = new TextEncoder();
  const entries: Array<{
    crc: number;
    data: Uint8Array;
    dosDate: number;
    dosTime: number;
    nameBytes: Uint8Array;
    offset: number;
    size: number;
  }> = [];

  const now = getDosDateTime();
  let currentOffset = 0;
  const localChunks: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = utf8Encoder.encode(file.name);
    const dataBytes = await fileDataToUint8Array(file.data);
    const fileCrc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, now.time, true);
    view.setUint16(12, now.date, true);
    view.setUint32(14, fileCrc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    entries.push({
      crc: fileCrc,
      data: dataBytes,
      dosDate: now.date,
      dosTime: now.time,
      nameBytes,
      offset: currentOffset,
      size,
    });

    localChunks.push(localHeader);
    localChunks.push(dataBytes);
    currentOffset += localHeader.length + dataBytes.length;
  }

  const centralOffset = currentOffset;
  const centralChunks: Uint8Array[] = [];
  let centralDirectorySize = 0;

  for (const entry of entries) {
    const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, entry.dosTime, true);
    view.setUint16(14, entry.dosDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    cdHeader.set(entry.nameBytes, 46);

    centralChunks.push(cdHeader);
    centralDirectorySize += cdHeader.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralDirectorySize, true);
  eocdView.setUint32(16, centralOffset, true);
  eocdView.setUint16(20, 0, true);

  const totalLength = centralOffset + centralDirectorySize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const chunk of localChunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  for (const chunk of centralChunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  result.set(eocd, pos);

  return new Blob([result], { type: 'application/zip' });
}

export async function downloadZip(files: ZipFileInput[], zipFilename = 'Spriteboard_Disenos.zip'): Promise<void> {
  const blob = await createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
