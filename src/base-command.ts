import {Command} from '@oclif/core'

export abstract class BaseCommand extends Command {
  public override jsonEnabled(): boolean {
    const separatorIndex = this.argv.indexOf('--')
    const flagArgs = separatorIndex === -1 ? this.argv : this.argv.slice(0, separatorIndex)
    if (flagArgs.includes('--toon')) return false
    return true
  }

  // oclif sets this.parsed=true only after Parser.parse() returns successfully.
  // When parse() throws (e.g. missing required arg), this.parsed stays false and
  // _run() emits an UnparsedCommand warning. The finally block prevents that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected override async parse(options?: any, argv?: string[]): Promise<any> {
    try {
      return await super.parse(options, argv)
    } finally {
      this.parsed = true
    }
  }

  // oclif's default toErrorJson returns the raw error object which for
  // CLIParseError includes context:this (the full config). Strip it down.
  protected override toErrorJson(err: unknown): {error: string} {
    const message = err instanceof Error ? err.message : String(err)
    return {error: message}
  }
}
