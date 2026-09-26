// Test code is left out of the score. It's there to exercise the real code, and
// rules like max-lines-per-function or hardcoded passwords misfire on it.
const testDirs = new Set(['test', 'tests', '__tests__']);
const testFile = /\.(test|spec)\.\w+$|^test_\w*\.py$|_test\.py$/;

export function isTestDir(name: string): boolean {
  return testDirs.has(name);
}

export function isTestFile(name: string): boolean {
  return testFile.test(name);
}

export function isTestPath(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const name = parts.pop() ?? '';
  return isTestFile(name) || parts.some(isTestDir);
}
