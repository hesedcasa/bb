import {encode} from '@toon-format/toon'

/**
 * Format data as TOON (Token-Oriented Object Notation)
 */
export function formatAsToon(data: unknown): string {
  if (!data) {
    return ''
  }

  return encode(data)
}
