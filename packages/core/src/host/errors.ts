/** Stable public error for host and component failures. */
export type DirectorStageErrorCode =
  | 'NOT_MOUNTED'
  | 'INVALID_DOCUMENT'
  | 'INVALID_HOST'
  | 'SAVE_FAILED'
  | 'LOAD_FAILED'
  | 'CAPTURE_FAILED'
  | 'RECORD_FAILED'
  | 'RECORD_UNAVAILABLE'
  | 'ABORTED'

/** Typed failure with a stable code for API callers.
 * @param code Stable machine code.
 * @param message Human-readable reason.
 * @param cause Optional original rejection.
 */
export class DirectorStageError extends Error {
  readonly code: DirectorStageErrorCode
  override readonly cause?: unknown

  constructor(code: DirectorStageErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'DirectorStageError'
    this.code = code
    this.cause = cause
  }
}

/** Wrap unknown failures without losing the original error.
 * @param code Public code to report.
 * @param error Thrown value.
 * @returns Existing DirectorStageError or a new wrapper.
 */
export function wrapDirectorError(code: DirectorStageErrorCode, error: unknown): DirectorStageError {
  if (error instanceof DirectorStageError) return error
  if (error instanceof DOMException && error.name === 'AbortError') return new DirectorStageError('ABORTED', error.message, error)
  const message = error instanceof Error ? error.message : String(error)
  return new DirectorStageError(code, message, error)
}
