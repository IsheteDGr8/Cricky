import { readFileSync } from 'node:fs';

/** Reads JSON written by the Firebase CLI or by PowerShell `>` (UTF-16 with BOM). */
export function readJsonFile(path: string): unknown {
  const raw = readFileSync(path);
  return JSON.parse(decodeText(raw));
}

function decodeText(raw: Buffer): string {
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    return raw.subarray(2).toString('utf16le');
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    const swapped = Buffer.alloc(raw.length - 2);
    for (let i = 2; i + 1 < raw.length; i += 2) {
      swapped[i - 2] = raw[i + 1] ?? 0;
      swapped[i - 1] = raw[i] ?? 0;
    }
    return swapped.toString('utf16le');
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    return raw.subarray(3).toString('utf8');
  }
  return raw.toString('utf8');
}
