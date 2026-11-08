import { inflateRawSync } from 'node:zlib';

/** Reads the first worksheet from the small, non-ZIP64 workbooks produced by the API. */
export function worksheetXml(workbook: Buffer): string {
  const end = workbook.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Excel workbook has no ZIP directory');
  let offset = workbook.readUInt32LE(end + 16);
  const entries = workbook.readUInt16LE(end + 10);
  for (let index = 0; index < entries; index++) {
    if (workbook.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const method = workbook.readUInt16LE(offset + 10);
    const compressedLength = workbook.readUInt32LE(offset + 20);
    const nameLength = workbook.readUInt16LE(offset + 28);
    const extraLength = workbook.readUInt16LE(offset + 30);
    const commentLength = workbook.readUInt16LE(offset + 32);
    const name = workbook.subarray(offset + 46, offset + 46 + nameLength).toString();
    if (name === 'xl/worksheets/sheet1.xml') {
      const local = workbook.readUInt32LE(offset + 42);
      const start =
        local + 30 + workbook.readUInt16LE(local + 26) + workbook.readUInt16LE(local + 28);
      const compressed = workbook.subarray(start, start + compressedLength);
      if (method === 0) return compressed.toString();
      if (method === 8) return inflateRawSync(compressed).toString();
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('Excel worksheet is missing');
}
