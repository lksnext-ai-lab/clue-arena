import { ConflictError } from '@/lib/utils/errors';

function getErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isSqliteConstraintError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE';
}

export function isSqliteBusyError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 'SQLITE_BUSY' || /database is locked/i.test(getErrorMessage(error));
}

export function toSqliteConflictError(
  error: unknown,
  message: string,
  code: string,
): ConflictError | null {
  if (isSqliteConstraintError(error) || isSqliteBusyError(error)) {
    return new ConflictError(message, code);
  }

  return null;
}
