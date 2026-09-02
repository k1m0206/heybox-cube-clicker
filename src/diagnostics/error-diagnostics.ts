const REDACTED_KEY = /(?:authorization|cookie|password|secret|token|nonce|code_verifier|codeVerifier)/i

function normalizeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Circular]'
  if (depth >= 5) return '[MaxDepth]'
  seen.add(value)

  if (Array.isArray(value)) return value.slice(0, 30).map(item => normalizeValue(item, seen, depth + 1))

  const source = value as Record<string, unknown>
  const keys = new Set([...Object.keys(source), ...Object.getOwnPropertyNames(value)])
  const normalized: Record<string, unknown> = {}
  for (const key of keys) {
    if (key === 'constructor') continue
    if (REDACTED_KEY.test(key)) {
      normalized[key] = '[REDACTED]'
      continue
    }
    try {
      normalized[key] = normalizeValue(source[key], seen, depth + 1)
    } catch (readError) {
      normalized[key] = `[Unreadable: ${readError instanceof Error ? readError.message : String(readError)}]`
    }
  }
  return normalized
}

export function formatErrorDiagnostic(
  stage: string,
  error: unknown,
  context: Record<string, unknown>,
) {
  const errorDetails = error instanceof Error
    ? normalizeValue(error, new WeakSet<object>(), 0)
    : normalizeValue({ thrownValue: error }, new WeakSet<object>(), 0)

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    stage,
    context: normalizeValue(context, new WeakSet<object>(), 0),
    error: errorDetails,
  }, null, 2)
}
