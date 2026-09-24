export type DataErrorCode =
  'not_signed_in' | 'permission_denied' | 'invalid_code' | 'invalid_data' | 'not_found';

export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataError';
    this.code = code;
  }
}

/** Firebase reports rule rejections as PERMISSION_DENIED / permission-denied. */
export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : '';
  return (
    code === 'PERMISSION_DENIED' ||
    code === 'permission-denied' ||
    /permission[_ -]denied/i.test(message)
  );
}

/** The error to rethrow from a failed write: rule rejections become DataErrors, others pass through. */
export function toWriteError(error: unknown, message: string): unknown {
  if (isPermissionDenied(error))
    return new DataError('permission_denied', message, { cause: error });
  return error;
}
