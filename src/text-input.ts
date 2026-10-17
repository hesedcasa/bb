import {readFile} from 'node:fs/promises'

/**
 * Read a text file, or stdin when `path` is `-`. Large text goes through a file
 * rather than argv because endpoint security agents (e.g. SentinelOne) block
 * processes with huge command lines — which is what `"$(cat file)"` produces.
 *
 * stdin is read as a stream: a synchronous read of fd 0 fails with EAGAIN once
 * anything has put it into non-blocking mode.
 */
const readTextFile = async (path: string): Promise<string> => {
  try {
    if (path !== '-') return await readFile(path, 'utf8')
    process.stdin.setEncoding('utf8')
    let text = ''
    for await (const chunk of process.stdin) text += chunk as string
    return text
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read ${path === '-' ? 'stdin' : path}: ${reason}`, {cause: error})
  }
}

/**
 * Turn literal `\n`/`\r` sequences typed into an inline flag into real line
 * breaks. Only for inline values: text read from a file is already literal, and
 * a `\n` inside a code sample there must survive.
 */
export const unescapeNewlines = (text: string): string =>
  // eslint-disable-next-line unicorn/prefer-string-replace-all
  text.replace(/\\n/g, '\n').replace(/\\r/g, '\r')

/**
 * The contents of `<path>` when `value` is `@<path>` (`@-` reads stdin), as
 * conni's `--fields` does; otherwise the inline value passed through `inline`.
 * `@@` escapes a literal leading `@`. File text is returned verbatim.
 */
export const readTextValue = async (value: string, inline = (text: string): string => text): Promise<string> =>
  value.startsWith('@@') ? inline(value.slice(1)) : value.startsWith('@') ? readTextFile(value.slice(1)) : inline(value)
