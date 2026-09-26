import { AppError } from './errorHandler';

type ValidationDetail = { field: string; message: string };

export function assertValidation(
  condition: boolean,
  field: string,
  message: string,
): void {
  if (!condition) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', [
      { field, message } satisfies ValidationDetail,
    ]);
  }
}

export function parseOptionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  assertValidation(Number.isFinite(parsed), field, 'must be a finite number');
  return parsed;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', [
    { field: 'blockPR', message: 'must be a boolean' },
  ]);
}
