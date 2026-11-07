#!/usr/bin/env -S node --loader ts-node/esm --experimental-specifier-resolution=node --disable-warning=ExperimentalWarning

// Dev mode imports the TypeScript sources directly, which requires the loader
// and resolution flags above. Those flags only apply when this file is
// executed directly (./bin/dev.js); when invoked as `node bin/dev.js` the
// shebang is ignored, so re-exec once with the same flags.
import {spawnSync} from 'node:child_process'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

if (
  !process.env.BB_DEV_REEXEC &&
  !process.execArgv.some((arg) => arg.startsWith('--experimental-specifier-resolution'))
) {
  const result = spawnSync(
    process.execPath,
    [
      '--loader',
      'ts-node/esm',
      '--experimental-specifier-resolution=node',
      '--disable-warning=ExperimentalWarning',
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    {env: {...process.env, BB_DEV_REEXEC: '1'}, stdio: 'inherit'},
  )
  process.exit(result.status ?? 1)
}

const {execute} = await import('@oclif/core')

await execute({development: true, dir: import.meta.url})
