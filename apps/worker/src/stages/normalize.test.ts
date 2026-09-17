import { describe, expect, it } from 'vitest';

import type { TodoScanReport } from '../analyzers/todoScan';
import { fromTodoScan, normalize } from './normalize';

const report: TodoScanReport = {
  matches: [
    { file: 'src/a.ts', line: 3, marker: 'TODO', text: 'tidy this' },
    { file: 'src/a.ts', line: 9, marker: 'FIXME', text: 'breaks on empty input' },
    { file: 'src/b.py', line: 1, marker: 'HACK', text: '' },
    { file: 'src/c.java', line: 7, marker: 'XXX', text: 'why?' },
  ],
  counts: { TODO: 1, FIXME: 1, HACK: 1, XXX: 1 },
};

describe('fromTodoScan', () => {
  it('maps every marker to a maintainability finding', () => {
    const findings = fromTodoScan(report);

    expect(findings).toHaveLength(4);
    for (const finding of findings) {
      expect(finding.category).toBe('MAINTAINABILITY');
      expect(finding.tool).toBe('todo-scan');
      expect(finding.state).toBe('UNKNOWN');
      expect(finding.endLine).toBe(finding.line);
    }
  });

  it('charges FIXME and HACK more than TODO and XXX', () => {
    const bySeverity = Object.fromEntries(
      fromTodoScan(report).map((f) => [f.rule, [f.severity, f.debtMinutes]]),
    );

    expect(bySeverity).toEqual({
      todo: ['LOW', 5],
      fixme: ['MEDIUM', 10],
      hack: ['MEDIUM', 10],
      xxx: ['LOW', 5],
    });
  });

  it('puts the note in the message and falls back to the bare marker', () => {
    const messages = fromTodoScan(report).map((f) => f.message);

    expect(messages).toEqual(['TODO: tidy this', 'FIXME: breaks on empty input', 'HACK', 'XXX: why?']);
  });

  it('is picked up by normalize', () => {
    const { findings } = normalize({ todoScan: report });

    expect(findings.map((f) => `${f.file}:${f.line}`)).toEqual([
      'src/a.ts:3',
      'src/a.ts:9',
      'src/b.py:1',
      'src/c.java:7',
    ]);
  });
});
