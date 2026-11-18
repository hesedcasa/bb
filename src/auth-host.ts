import {createProfileManager} from '@hesed/plugin-lib'
import {type Command, type Config, Flags, type Parser} from '@oclif/core'

/**
 * The Bitbucket instance URL stored when `-u, --host` is omitted.
 *
 * Bitbucket Cloud, matching the API base URL the CLI hardcodes
 * (`https://api.bitbucket.org/2.0` in `bitbucket-api.ts`) and the git
 * credential host `bb bb repo clone` uses (`bitbucket.org`). Nothing reads the
 * stored host: it is profile metadata kept for forward compatibility.
 */
export const DEFAULT_HOST = 'https://bitbucket.org'

/** Which of the two shared auth factories is being wrapped. */
export type HostMode = 'add' | 'update'

/** A class the auth factories return, as a constructible type. */
type AuthCommandConstructor = new (argv: string[], config: Config) => Command

type OptionalHostOptions = {
  /** Config file the factory was given, so the stored host is read from the same file. */
  configFile: string
  mode: HostMode
}

/** oclif's parser input/output type parameters, restated for the parse override. */
type FlagOutput = Record<string, unknown>
type ArgOutput = Record<string, unknown>

type ResolveHostOptions = {
  configFile: string
  mode: HostMode
  profile: unknown
}

/**
 * Makes `-u, --host` optional on a command built by `@hesed/plugin-lib`'s
 * `createAuthAddCommand` / `createAuthUpdateCommand`, defaulting to
 * {@link DEFAULT_HOST}.
 *
 * The shared factories make every legacy field a required flag when stdout is
 * not a TTY, so scripts must pass `-u` even though nothing reads the value.
 * plugin-lib grows the same behaviour as an opt-in `defaultHost` factory
 * option (hesedcasa/plugin-lib#112), but no release carrying it is published
 * yet — this repo still resolves `^0.13.0` — so the relaxation lives here
 * until that release ships and the two wrappers can pass `defaultHost`
 * instead. Only this CLI opts in: sibling CLIs built on the factories keep
 * their required-host behaviour.
 *
 * The flag is relaxed in every mode, and the resolved host is injected into
 * the parsed flags before the factory collects the profile fields — so `-u` is
 * never prompted for, and the value persisted is the one handed to
 * `testConnection`:
 *
 * - `add`: omission stores {@link DEFAULT_HOST}; `-u` still wins.
 * - `update`: omission preserves the host already stored on the profile,
 *   falling back to {@link DEFAULT_HOST} when it has none; `-u` still
 *   overwrites.
 *
 * @param Base A command class returned by one of the auth factories.
 * @param hostOptions The config file the factory uses and the mode being wrapped.
 * @returns A subclass of `Base` whose `host` flag is optional.
 */
export function withOptionalHost(Base: typeof Command, hostOptions: OptionalHostOptions): typeof Command {
  const {configFile, mode} = hostOptions
  // Every class the auth factories return implements `run`; oclif's own
  // `Command` declares it abstract, which a class expression extending
  // `typeof Command` could not satisfy. Extending the constructor signature
  // keeps the wrapper assignable to the factories' contract.
  const ConcreteBase = Base as unknown as AuthCommandConstructor

  abstract class Wrapped extends ConcreteBase {
    // Everything but `required` is inherited from the factory's own flag
    // definition, so help output and validation stay the factory's.
    static flags = {
      ...Base.flags,
      host: Flags.string({char: 'u', description: Base.flags.host.description, required: false}),
    }

    protected override async parse<F extends FlagOutput, B extends FlagOutput, A extends ArgOutput>(
      options?: Parser.Input<F, B, A>,
      argv?: string[],
    ): Promise<Parser.ParserOutput<F, B, A>> {
      const parsed = await super.parse(options, argv)
      const {flags} = parsed as {flags: Record<string, unknown>}

      if (flags.host === undefined) {
        const host = await resolveHost(this.config, {configFile, mode, profile: flags.profile})
        if (host !== undefined) flags.host = host
      }

      return parsed
    }
  }

  // `abstract` only satisfies oclif's abstract `run` declaration: the factory's
  // implementation is inherited, and oclif instantiates the class normally.
  return Wrapped as unknown as typeof Command
}

/**
 * Resolves the host to store when `-u` was omitted.
 *
 * @param config The running command's config, for its config dir.
 * @param options The wrapped config file, mode and requested profile name.
 * @returns The host to inject, or undefined to leave the flag unset.
 */
async function resolveHost(config: Config, options: ResolveHostOptions): Promise<string | undefined> {
  const {configFile, mode, profile} = options

  if (mode === 'add') return DEFAULT_HOST

  // Without a profile name there is no stored host to preserve: the factory
  // prompts for the profile (TTY only) and then for the host, as it did before
  // this wrapper existed.
  if (typeof profile !== 'string' || profile === '') return undefined

  return (await readStoredHost(config, configFile, profile)) ?? DEFAULT_HOST
}

/**
 * Reads the raw host stored on `profile`.
 *
 * A missing or unreadable config file yields undefined rather than an error:
 * reporting that is the factory's job, and this read must not change which
 * errors the command surfaces.
 *
 * @param config The running command's config, for its config dir.
 * @param configFile The config file name, e.g. `bb-config.json`.
 * @param profile The profile name to read.
 * @returns The stored host, or undefined when there is none.
 */
async function readStoredHost(config: Config, configFile: string, profile: string): Promise<string | undefined> {
  try {
    const profiles = await createProfileManager(config, profile, configFile).readProfiles()
    return profiles[profile]?.host
  } catch {
    return undefined
  }
}
