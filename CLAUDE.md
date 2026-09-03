# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**bb** is an Oclif plugin/CLI for the Bitbucket Cloud REST API v2 (repositories, pull requests, commits, pipelines, workspaces). Published as `@hesed/bb`; it runs standalone via `bin/run.js` and is also installed as a plugin into the `sdkck` host CLI (`sdkck plugins install @hesed/bb`).

Shared plumbing (auth profiles, secret resolution, TOON formatting, `ApiResult`, API-client singleton, generated auth commands) lives in the sibling package **`@hesed/plugin-lib`** — not in this repo. When something looks missing from `src/`, check `node_modules/@hesed/plugin-lib/dist/*.d.ts`.

## Development Commands

```bash
npm run build                  # shx rm -rf dist && tsc -b
npm test                       # mocha; posttest runs lint
npx mocha test/commands/bb/repo/get.test.ts   # single test file
npm run test:coverage          # c8; fails under 50% lines/functions/branches/statements
npm run test:coverage:report   # HTML report
npm run lint                   # eslint
npm run format                 # eslint --fix + prettier --write
npm run find-deadcode          # ts-prune --ignore '(run|default)'
npm run pre-commit             # format + find-deadcode (also runs via git hook)

./bin/dev.js bb repo my-workspace my-repo    # run a command from source (ts-node loader)
```

## Architecture

```
src/
├── base-command.ts   # BaseCommand — all hand-written commands extend this
├── commands/bb/      # Oclif commands, namespaced under bb/
│   ├── auth/         # add, delete, list, profile, test, update (all plugin-lib factories)
│   ├── commit/       # index (get), list
│   ├── pipeline/     # index (list), get, trigger
│   ├── pr/           # index (get), activity, approve, comment, comment-delete,
│   │                 # comment-reply, comment-resolve, comment-update, comments,
│   │                 # commits, create, decline, diff, list, merge, unapprove, update
│   ├── repo/         # index (get), create, delete, list
│   └── workspace/    # index (get), list
└── bitbucket/
    ├── bitbucket-api.ts     # BitbucketApi class — native fetch against the REST API
    └── bitbucket-client.ts  # thin functional wrappers over a singleton client
```

### Key patterns

**1. `index.ts` is the "get" command.** `src/commands/bb/repo/index.ts` exports class `RepoGet` and is invoked as `bb repo <workspace> <repoSlug>`; there is no `get.ts`. Note the test files don't mirror this (`test/commands/bb/repo/get.test.ts` imports `src/commands/bb/repo/index.js`).

**2. Three tiers.** Command (parse args, load auth) → `bitbucket-client.ts` (one wrapper fn per API call, resolves the singleton) → `BitbucketApi` (builds the request). The singleton comes from plugin-lib's `createApiClient('Bitbucket', config => new BitbucketApi(config))`; commands must call `clearClients()` after the API call.

**3. `ApiResult` everywhere.** Non-generic `{data?: unknown; error?: unknown; success: boolean}`, imported from `@hesed/plugin-lib`. Every API and client function returns it; HTTP failures are returned as `{success: false, error}`, never thrown. A 204/empty body becomes `{success: true, data: true}`.

**4. Output is the `run()` return value, not a log call.** `BaseCommand.jsonEnabled()` returns `true` unless `--toon` is present, so oclif serializes whatever `run()` returns as JSON. Commands therefore `return result` and only call `this.log(formatAsToon(result))` when `flags.toon` is set. Do **not** add `this.logJson(result)` to a JSON/TOON command — that double-prints.

**5. `BaseCommand` exists for three oclif workarounds** (see comments in `src/base-command.ts`): `--toon` detection before `--`, forcing `this.parsed = true` in a `finally` so parse errors don't emit an `UnparsedCommand` warning, and trimming `toErrorJson` down to `{error: message}` (oclif's default leaks the whole config through `CLIParseError.context`).

**6. Auth commands are generated.** Each file under `commands/bb/auth/` is a one-liner delegating to a plugin-lib factory, e.g.:

```typescript
export default createAuthAddCommand({
  clearClients,
  configFile: 'bb-config.json',
  serviceName: 'Bitbucket',
  testConnection,
})
```

Their behavior is tested in plugin-lib; the tests here only assert the export is a function.

## Adding a New Command

1. Create `src/commands/bb/<category>/<name>.ts` (or `index.ts` for the category's get/list default).
2. Extend `BaseCommand` from `../../../base-command.js`.
3. Define static `args`, `flags`, `description`, `examples`. Always include `profile: Flags.string({char: 'p', ...})`, and `toon: Flags.boolean(...)` for JSON commands.
4. In `run()`: parse, load auth, call the client fn, `clearClients()`, log TOON if flagged, return the `ApiResult`.

```typescript
import {type ApiResult, createProfileManager, formatAsToon} from '@hesed/plugin-lib'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base-command.js'
import {clearClients, getRepository} from '../../../bitbucket/bitbucket-client.js'

export default class RepoGet extends BaseCommand {
  /* eslint-disable perfectionist/sort-objects -- Oclif parses args positionally, so declaration order is significant */
  static override args = {
    workspace: Args.string({description: 'Workspace slug or UUID', required: true}),
    repoSlug: Args.string({description: 'Repository slug', required: true}),
  }

  /* eslint-enable perfectionist/sort-objects */
  static override description = 'Get details of a specific repository'
  static override examples = ['<%= config.bin %> <%= command.id %> my-workspace my-repo']
  static override flags = {
    profile: Flags.string({char: 'p', description: 'Authentication profile name', required: false}),
    toon: Flags.boolean({description: 'Format output as toon', required: false}),
  }

  public async run(): Promise<ApiResult> {
    const {args, flags} = await this.parse(RepoGet)
    const {loadAuthConfig} = createProfileManager(this.config, flags.profile, 'bb-config.json')
    const auth = await loadAuthConfig()
    if (!auth) {
      this.error(`Missing authentication config.`)
    }

    const result = await getRepository(auth, args.workspace, args.repoSlug)
    clearClients()

    if (flags.toon) {
      this.log(formatAsToon(result))
    }

    return result
  }
}
```

**Plain-text commands** (only `pr diff` today): omit `--toon`, override `jsonEnabled()` to `false`, and `this.log(result.data as string)` on success / `this.logJson(result)` on failure.

**Flag validation** goes before auth loading, via `this.error()` — see the paired `--file`/`--line` check in `pr/comment.ts`.

## Adding New API Functions

1. Add a method to `BitbucketApi` in `bitbucket-api.ts` returning `Promise<ApiResult>`.
2. Export a wrapper in `bitbucket-client.ts` that does `const bb = await getClient(config)` and delegates.
3. Pick the right private helper: `request(path, {body?, method?})` for JSON responses (sets `Content-Type` only when a body is present); `requestText(path)` for plain text (`Accept: text/plain`, returns the raw string in `data`).

The base URL is hardcoded to `https://api.bitbucket.org/2.0` in `getBaseUrl()`; the `host` field on `AuthConfig` is not used for API requests.

## Configuration & Auth

Config lives at `<oclif configDir>/bb-config.json` (e.g. `~/.config/bb/bb-config.json`, or the host CLI's config dir when run as a plugin). **`'bb-config.json'` must be passed explicitly** to `createProfileManager` / the auth factories — otherwise plugin-lib derives the filename from `config.bin`, which differs when running under `sdkck`.

Profile-based format, with the legacy single-`auth` shape still supported:

```json
{
  "defaultProfile": "work",
  "profiles": {
    "work": {"email": "user@example.com", "apiToken": "token"}
  }
}
```

**Nothing in this repo loads `.env`** — there is no dotenv dependency, so the variables must already be in the process environment. Export them before running any command that talks to Confluence:

```bash
set -a; . ./.env; set +a
./bin/dev.js bb auth test
```

## Testing

Mocha + Chai, `esmock` for module mocking, `sinon` for stubs; `ts-node/esm` loader, 60s timeout (`.mocharc.json`). Tests mirror source structure under `test/`.

**Command tests** — mock the client module and `@hesed/plugin-lib`, instantiate the class directly, and assert on the **return value** of `run()`:

```typescript
const imported = await esmock('../../../../src/commands/bb/repo/index.js', {
  '../../../../src/bitbucket/bitbucket-client.js': {clearClients: clearClientsStub, getRepository: getRepositoryStub},
  '@hesed/plugin-lib': {createProfileManager: createProfileManagerStub, formatAsToon: formatAsToonStub},
})
const cmd = new imported.default(['my-ws', 'my-repo'], {
  root: process.cwd(),
  runHook: stub().resolves({failures: [], successes: []}),
} as any)
const result = await cmd.run()
```

`createProfileManagerStub` returns `{loadAuthConfig: stub().resolves(mockAuth)}`; resolve `null` to cover the missing-config path (which throws via `this.error`, so wrap in try/catch).

**API layer tests** stub `globalThis.fetch` directly (`fetchStub = stub(globalThis, 'fetch')`, `.resolves(new Response(...))`, restore in `afterEach`).

## Conventions & Gotchas

- ESM throughout: `.js` extensions in all relative imports.
- Node.js >= 22 (ESLint 10 / eslint-plugin-unicorn); native `fetch`, no HTTP library.
- `static override args` blocks need the `perfectionist/sort-objects` disable/enable pair with a `-- <reason>` description (Oclif parses args positionally; `@eslint-community/eslint-comments/require-description` requires the reason).
- Functions with >3 params need `// eslint-disable-next-line max-params` — common in `bitbucket-client.ts` and paginated API methods.
- JSDoc `@param` for inline object params must list each property in dot-notation (`@param options.description`).
- `eslint.config.mjs` deliberately relaxes several `eslint-config-oclif@7` rules (type-checked rules off for `test/`, `no-unsafe-*` off for commands, `perfectionist/sort-classes` off); read it before "fixing" a lint complaint.
- README's usage/commands sections are generated by `oclif readme` (`prepack`, `version` scripts) — don't hand-edit them.
- Releases: release-please + `bb-v*` tags trigger `publish-on-tag.yml`; PR titles are validated by `convetional-commit.yml`.

## Commit Message Convention

**Always use Conventional Commits** for commits and PR titles (enforced in CI): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

```
feat: add pr comment-resolve command
fix: handle empty response bodies in requestText
chore: bump @hesed/plugin-lib to 0.12.1
```
