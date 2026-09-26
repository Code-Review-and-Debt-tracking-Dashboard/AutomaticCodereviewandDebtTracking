import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runTodoScan, scanSource } from './todoScan';

describe('scanSource', () => {
  it('finds each marker after a comment opener', () => {
    const text = [
      '// TODO first',
      '# FIXME: second',
      '/* HACK third */',
      ' * XXX fourth',
      '<!-- TODO fifth -->',
      '-- FIXME sixth',
    ].join('\n');

    expect(scanSource(text)).toEqual([
      { line: 1, marker: 'TODO', text: 'first' },
      { line: 2, marker: 'FIXME', text: 'second' },
      { line: 3, marker: 'HACK', text: 'third' },
      { line: 4, marker: 'XXX', text: 'fourth' },
      { line: 5, marker: 'TODO', text: 'fifth' },
      { line: 6, marker: 'FIXME', text: 'sixth' },
    ]);
  });

  it('reports 1-based line numbers and keeps the marker on its own', () => {
    expect(scanSource('const a = 1;\n\n  // TODO')).toEqual([{ line: 3, marker: 'TODO', text: '' }]);
  });

  it('ignores lowercase markers and markers that do not open a comment', () => {
    const text = [
      '// todo lowercase',
      "const s = 'TODO in a string';",
      '// we should TODO this later',
      'const TODO = 1;',
      '// TODOS are not a marker',
    ].join('\n');

    expect(scanSource(text)).toEqual([]);
  });

  it('handles Windows line endings', () => {
    expect(scanSource('// TODO(Backend): match the API\r\nexport {};\r\n')).toEqual([
      { line: 1, marker: 'TODO', text: '(Backend): match the API' },
    ]);
  });

  it('caps a long note', () => {
    const note = 'x'.repeat(300);
    const [found] = scanSource(`// TODO ${note}`);

    expect(found.text).toHaveLength(201);
    expect(found.text.endsWith('…')).toBe(true);
  });
});

describe('runTodoScan', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'codehealth-todo-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('walks source files, skips vendored code, and reports relative paths', async () => {
    await mkdir(join(root, 'src', 'lib'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'dep'), { recursive: true });

    await writeFile(join(root, 'src', 'a.ts'), '// TODO one\nexport {};\n');
    await writeFile(join(root, 'src', 'lib', 'b.py'), 'x = 1\n# FIXME two\n');
    await writeFile(join(root, 'src', 'notes.md'), '// TODO not source\n');
    await writeFile(join(root, 'src', 'app.min.js'), '// HACK generated\n');
    await writeFile(join(root, 'node_modules', 'dep', 'index.js'), '// XXX vendored\n');

    const report = await runTodoScan(root);

    expect(report.matches).toEqual([
      { file: 'src/a.ts', line: 1, marker: 'TODO', text: 'one' },
      { file: 'src/lib/b.py', line: 2, marker: 'FIXME', text: 'two' },
    ]);
    expect(report.counts).toEqual({ TODO: 1, FIXME: 1, HACK: 0, XXX: 0 });
  });

  it('returns nothing for an empty checkout', async () => {
    const report = await runTodoScan(root);

    expect(report.matches).toEqual([]);
    expect(report.counts).toEqual({ TODO: 0, FIXME: 0, HACK: 0, XXX: 0 });
  });
});
