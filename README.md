# bb

CLI for Bitbucket API interaction

[![Version](https://img.shields.io/npm/v/@hesed/bb.svg)](https://npmjs.org/package/@hesed/bb)
[![Downloads/week](https://img.shields.io/npm/dw/@hesed/bb.svg)](https://npmjs.org/package/@hesed/bb)

# Install

```bash
sdkck plugins install @hesed/bb
```

<!-- toc -->
* [bb](#bb)
* [Install](#install)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @hesed/bb
$ bb COMMAND
running command...
$ bb (--version)
@hesed/bb/0.4.0 linux-x64 node-v20.20.2
$ bb --help [COMMAND]
USAGE
  $ bb COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`bb bb auth add`](#bb-bb-auth-add)
* [`bb bb auth test`](#bb-bb-auth-test)
* [`bb bb auth update`](#bb-bb-auth-update)
* [`bb bb pipeline get WORKSPACE REPOSLUG PIPELINEUUID`](#bb-bb-pipeline-get-workspace-reposlug-pipelineuuid)
* [`bb bb pipeline list WORKSPACE REPOSLUG`](#bb-bb-pipeline-list-workspace-reposlug)
* [`bb bb pipeline trigger WORKSPACE REPOSLUG`](#bb-bb-pipeline-trigger-workspace-reposlug)
* [`bb bb pr approve WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-approve-workspace-reposlug-pullrequestid)
* [`bb bb pr create WORKSPACE REPOSLUG`](#bb-bb-pr-create-workspace-reposlug)
* [`bb bb pr decline WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-decline-workspace-reposlug-pullrequestid)
* [`bb bb pr diff WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-diff-workspace-reposlug-pullrequestid)
* [`bb bb pr get WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-get-workspace-reposlug-pullrequestid)
* [`bb bb pr list WORKSPACE REPOSLUG`](#bb-bb-pr-list-workspace-reposlug)
* [`bb bb pr merge WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-merge-workspace-reposlug-pullrequestid)
* [`bb bb pr unapprove WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-unapprove-workspace-reposlug-pullrequestid)
* [`bb bb pr update WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-update-workspace-reposlug-pullrequestid)
* [`bb bb repo create WORKSPACE REPOSLUG`](#bb-bb-repo-create-workspace-reposlug)
* [`bb bb repo delete WORKSPACE REPOSLUG`](#bb-bb-repo-delete-workspace-reposlug)
* [`bb bb repo get WORKSPACE REPOSLUG`](#bb-bb-repo-get-workspace-reposlug)
* [`bb bb repo list WORKSPACE`](#bb-bb-repo-list-workspace)
* [`bb bb workspace get WORKSPACE`](#bb-bb-workspace-get-workspace)
* [`bb bb workspace list`](#bb-bb-workspace-list)

## `bb bb auth add`

Add Bitbucket authentication

```
USAGE
  $ bb bb auth add -t <value> [--json] [-e <value>]

FLAGS
  -e, --email=<value>  Account email:
  -t, --token=<value>  (required) API Token:

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Add Bitbucket authentication

EXAMPLES
  $ bb bb auth add
```

_See code: [src/commands/bb/auth/add.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/auth/add.ts)_

## `bb bb auth test`

Test authentication and connection

```
USAGE
  $ bb bb auth test [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Test authentication and connection

EXAMPLES
  $ bb bb auth test
```

_See code: [src/commands/bb/auth/test.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/auth/test.ts)_

## `bb bb auth update`

Update existing authentication

```
USAGE
  $ bb bb auth update -t <value> [--json] [-e <value>]

FLAGS
  -e, --email=<value>  Account email
  -t, --token=<value>  (required) API Token

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Update existing authentication

EXAMPLES
  $ bb bb auth update
```

_See code: [src/commands/bb/auth/update.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/auth/update.ts)_

## `bb bb pipeline get WORKSPACE REPOSLUG PIPELINEUUID`

Get details of a specific pipeline

```
USAGE
  $ bb bb pipeline get WORKSPACE REPOSLUG PIPELINEUUID [--toon]

ARGUMENTS
  WORKSPACE     Workspace slug or UUID
  REPOSLUG      Repository slug
  PIPELINEUUID  Pipeline UUID

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Get details of a specific pipeline

EXAMPLES
  $ bb bb pipeline get my-workspace my-repo {uuid}
```

_See code: [src/commands/bb/pipeline/get.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pipeline/get.ts)_

## `bb bb pipeline list WORKSPACE REPOSLUG`

List pipelines for a repository

```
USAGE
  $ bb bb pipeline list WORKSPACE REPOSLUG [--page <value>] [--pagelen <value>] [--sort <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --page=<value>     [default: 1] Page number
  --pagelen=<value>  [default: 10] Number of items per page
  --sort=<value>     Sort field (e.g., created_on)
  --toon             Format output as toon

DESCRIPTION
  List pipelines for a repository

EXAMPLES
  $ bb bb pipeline list my-workspace my-repo
```

_See code: [src/commands/bb/pipeline/list.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pipeline/list.ts)_

## `bb bb pipeline trigger WORKSPACE REPOSLUG`

Trigger a pipeline run

```
USAGE
  $ bb bb pipeline trigger WORKSPACE REPOSLUG --branch <value> [--custom <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --branch=<value>  (required) Branch name to run pipeline on
  --custom=<value>  Custom pipeline pattern name
  --toon            Format output as toon

DESCRIPTION
  Trigger a pipeline run

EXAMPLES
  $ bb bb pipeline trigger my-workspace my-repo --branch main

  $ bb bb pipeline trigger my-workspace my-repo --branch main --custom my-pipeline
```

_See code: [src/commands/bb/pipeline/trigger.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pipeline/trigger.ts)_

## `bb bb pr approve WORKSPACE REPOSLUG PULLREQUESTID`

Approve a pull request

```
USAGE
  $ bb bb pr approve WORKSPACE REPOSLUG PULLREQUESTID [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Approve a pull request

EXAMPLES
  $ bb bb pr approve my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/approve.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/approve.ts)_

## `bb bb pr create WORKSPACE REPOSLUG`

Create a new pull request

```
USAGE
  $ bb bb pr create WORKSPACE REPOSLUG --destination <value> --source <value> --title <value> [--description
    <value>] [--reviewers <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --description=<value>  Pull request description
  --destination=<value>  (required) Destination branch name
  --reviewers=<value>    Comma-separated list of reviewer UUIDs
  --source=<value>       (required) Source branch name
  --title=<value>        (required) Pull request title
  --toon                 Format output as toon

DESCRIPTION
  Create a new pull request

EXAMPLES
  $ bb bb pr create my-workspace my-repo --title "My PR" --source feature-branch --destination main
```

_See code: [src/commands/bb/pr/create.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/create.ts)_

## `bb bb pr decline WORKSPACE REPOSLUG PULLREQUESTID`

Decline a pull request

```
USAGE
  $ bb bb pr decline WORKSPACE REPOSLUG PULLREQUESTID [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Decline a pull request

EXAMPLES
  $ bb bb pr decline my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/decline.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/decline.ts)_

## `bb bb pr diff WORKSPACE REPOSLUG PULLREQUESTID`

Get the diff for a pull request

```
USAGE
  $ bb bb pr diff WORKSPACE REPOSLUG PULLREQUESTID

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

DESCRIPTION
  Get the diff for a pull request

EXAMPLES
  $ bb bb pr diff my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/diff.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/diff.ts)_

## `bb bb pr get WORKSPACE REPOSLUG PULLREQUESTID`

Get details of a specific pull request

```
USAGE
  $ bb bb pr get WORKSPACE REPOSLUG PULLREQUESTID [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Get details of a specific pull request

EXAMPLES
  $ bb bb pr get my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/get.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/get.ts)_

## `bb bb pr list WORKSPACE REPOSLUG`

List pull requests for a repository

```
USAGE
  $ bb bb pr list WORKSPACE REPOSLUG [--page <value>] [--pagelen <value>] [--state <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --page=<value>     [default: 1] Page number
  --pagelen=<value>  [default: 10] Number of items per page
  --state=<value>    Filter by state (OPEN, MERGED, DECLINED, SUPERSEDED)
  --toon             Format output as toon

DESCRIPTION
  List pull requests for a repository

EXAMPLES
  $ bb bb pr list my-workspace my-repo
```

_See code: [src/commands/bb/pr/list.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/list.ts)_

## `bb bb pr merge WORKSPACE REPOSLUG PULLREQUESTID`

Merge a pull request

```
USAGE
  $ bb bb pr merge WORKSPACE REPOSLUG PULLREQUESTID [--close-source-branch] [-m <value>] [--strategy
    merge_commit|squash|fast_forward] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -m, --message=<value>      Merge commit message
      --close-source-branch  Close source branch after merge
      --strategy=<option>    Merge strategy (merge_commit, squash, fast_forward)
                             <options: merge_commit|squash|fast_forward>
      --toon                 Format output as toon

DESCRIPTION
  Merge a pull request

EXAMPLES
  $ bb bb pr merge my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/merge.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/merge.ts)_

## `bb bb pr unapprove WORKSPACE REPOSLUG PULLREQUESTID`

Remove approval from a pull request

```
USAGE
  $ bb bb pr unapprove WORKSPACE REPOSLUG PULLREQUESTID [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Remove approval from a pull request

EXAMPLES
  $ bb bb pr unapprove my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/unapprove.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/unapprove.ts)_

## `bb bb pr update WORKSPACE REPOSLUG PULLREQUESTID`

Update a pull request

```
USAGE
  $ bb bb pr update WORKSPACE REPOSLUG PULLREQUESTID [--description <value>] [--title <value>] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  --description=<value>  Pull request description
  --title=<value>        Pull request title
  --toon                 Format output as toon

DESCRIPTION
  Update a pull request

EXAMPLES
  $ bb bb pr update my-workspace my-repo 1 --title "Updated title"
```

_See code: [src/commands/bb/pr/update.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/pr/update.ts)_

## `bb bb repo create WORKSPACE REPOSLUG`

Create a new repository

```
USAGE
  $ bb bb repo create WORKSPACE REPOSLUG [--description <value>] [--language <value>] [--private] [--project-key
    <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --description=<value>  Repository description
  --language=<value>     Repository language
  --private              Make repository private
  --project-key=<value>  Project key
  --toon                 Format output as toon

DESCRIPTION
  Create a new repository

EXAMPLES
  $ bb bb repo create my-workspace my-repo

  $ bb bb repo create my-workspace my-repo --private --description "My new repo"
```

_See code: [src/commands/bb/repo/create.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/repo/create.ts)_

## `bb bb repo delete WORKSPACE REPOSLUG`

Delete a repository

```
USAGE
  $ bb bb repo delete WORKSPACE REPOSLUG [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Delete a repository

EXAMPLES
  $ bb bb repo delete my-workspace my-repo
```

_See code: [src/commands/bb/repo/delete.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/repo/delete.ts)_

## `bb bb repo get WORKSPACE REPOSLUG`

Get details of a specific repository

```
USAGE
  $ bb bb repo get WORKSPACE REPOSLUG [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Get details of a specific repository

EXAMPLES
  $ bb bb repo get my-workspace my-repo
```

_See code: [src/commands/bb/repo/get.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/repo/get.ts)_

## `bb bb repo list WORKSPACE`

List repositories in a workspace

```
USAGE
  $ bb bb repo list WORKSPACE [--page <value>] [--pagelen <value>] [--q <value>] [--role <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID

FLAGS
  --page=<value>     [default: 1] Page number
  --pagelen=<value>  [default: 10] Number of items per page
  --q=<value>        Query string to filter repositories
  --role=<value>     Filter by role (admin, contributor, member, owner)
  --toon             Format output as toon

DESCRIPTION
  List repositories in a workspace

EXAMPLES
  $ bb bb repo list my-workspace
```

_See code: [src/commands/bb/repo/list.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/repo/list.ts)_

## `bb bb workspace get WORKSPACE`

Get details of a specific workspace

```
USAGE
  $ bb bb workspace get WORKSPACE [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID

FLAGS
  --toon  Format output as toon

DESCRIPTION
  Get details of a specific workspace

EXAMPLES
  $ bb bb workspace get my-workspace
```

_See code: [src/commands/bb/workspace/get.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/workspace/get.ts)_

## `bb bb workspace list`

List all accessible workspaces

```
USAGE
  $ bb bb workspace list [--page <value>] [--pagelen <value>] [--toon]

FLAGS
  --page=<value>     [default: 1] Page number
  --pagelen=<value>  [default: 10] Number of items per page
  --toon             Format output as toon

DESCRIPTION
  List all accessible workspaces

EXAMPLES
  $ bb bb workspace list
```

_See code: [src/commands/bb/workspace/list.ts](https://github.com/hesedcasa/bb/blob/v0.4.0/src/commands/bb/workspace/list.ts)_
<!-- commandsstop -->
