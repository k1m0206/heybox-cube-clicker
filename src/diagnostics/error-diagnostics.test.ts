import { describe, expect, it } from 'vitest'
import { formatErrorDiagnostic } from './error-diagnostics'

describe('formatErrorDiagnostic', () => {
  it('keeps Error details and redacts credentials', () => {
    const error = Object.assign(new Error('host failed'), {
      code: 'RUNTIME_ERROR',
      data: { local_identity: null, token: 'must-not-leak' },
    })
    error.cause = new TypeError("null is not an object (evaluating 'r.local_identity')")

    const result = formatErrorDiagnostic('user.getInfo.attempt_1', error, {
      appVersion: '1.2.14', authorization: 'must-not-leak',
    })

    expect(result).toContain('RUNTIME_ERROR')
    expect(result).toContain('local_identity')
    expect(result).toContain('TypeError')
    expect(result).not.toContain('must-not-leak')
  })

  it('handles circular diagnostic data', () => {
    const data: Record<string, unknown> = {}
    data.self = data
    expect(formatErrorDiagnostic('test', data, {})).toContain('[Circular]')
  })
})
