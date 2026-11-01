import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonFile } from '../read-json';

const dir = mkdtempSync(join(tmpdir(), 'cricky-json-'));

describe('readJsonFile', () => {
  it('reads UTF-8', () => {
    const path = join(dir, 'utf8.json');
    writeFileSync(path, '{"ok":true}');
    expect(readJsonFile(path)).toEqual({ ok: true });
  });

  it('reads PowerShell UTF-16 LE with BOM', () => {
    const path = join(dir, 'utf16.json');
    writeFileSync(
      path,
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"ok":1}', 'utf16le')]),
    );
    expect(readJsonFile(path)).toEqual({ ok: 1 });
  });
});
