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
@hesed/bb/0.8.0 linux-x64 node-v22.22.3
$ bb --help [COMMAND]
USAGE
  $ bb COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`bb bb auth add`](#bb-bb-auth-add)
* [`bb bb auth delete`](#bb-bb-auth-delete)
* [`bb bb auth list`](#bb-bb-auth-list)
* [`bb bb auth profile`](#bb-bb-auth-profile)
* [`bb bb auth test`](#bb-bb-auth-test)
* [`bb bb auth update`](#bb-bb-auth-update)
* [`bb bb pipeline get WORKSPACE REPOSLUG PIPELINEUUID`](#bb-bb-pipeline-get-workspace-reposlug-pipelineuuid)
* [`bb bb pipeline list WORKSPACE REPOSLUG`](#bb-bb-pipeline-list-workspace-reposlug)
* [`bb bb pipeline trigger WORKSPACE REPOSLUG`](#bb-bb-pipeline-trigger-workspace-reposlug)
* [`bb bb pr approve WORKSPACE REPOSLUG PULLREQUESTID`](#bb-bb-pr-approve-workspace-reposlug-pullrequestid)
* [`bb bb pr comment WORKSPACE REPOSLUG PRID`](#bb-bb-pr-comment-workspace-reposlug-prid)
* [`bb bb pr comment-delete WORKSPACE REPOSLUG PRID COMMENTID`](#bb-bb-pr-comment-delete-workspace-reposlug-prid-commentid)
* [`bb bb pr comment-reply WORKSPACE REPOSLUG PRID COMMENTID`](#bb-bb-pr-comment-reply-workspace-reposlug-prid-commentid)
* [`bb bb pr comment-resolve WORKSPACE REPOSLUG PRID COMMENTID`](#bb-bb-pr-comment-resolve-workspace-reposlug-prid-commentid)
* [`bb bb pr comment-update WORKSPACE REPOSLUG PRID COMMENTID`](#bb-bb-pr-comment-update-workspace-reposlug-prid-commentid)
* [`bb bb pr comments WORKSPACE REPOSLUG PRID`](#bb-bb-pr-comments-workspace-reposlug-prid)
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
  $ bb bb auth add -p <value> -t <value> -e <value> -u <value> [--json]

FLAGS
  -e, --email=<value>     (required) Account email
  -p, --profile=<value>   (required) Profile name
  -t, --apiToken=<value>  (required) API Token
  -u, --host=<value>      (required) Bitbucket instance URL

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Add Bitbucket authentication

EXAMPLES
  $ bb bb auth add

  $ bb bb auth add -p prod
```

_See code: [src/commands/bb/auth/add.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/auth/add.ts)_

## `bb bb auth delete`

Delete an authentication profile

```
USAGE
  $ bb bb auth delete [--json] [-p <value>]

FLAGS
  -p, --profile=<value>  Profile to delete

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete an authentication profile

EXAMPLES
  $ bb bb auth delete

  $ bb bb auth delete -p prod
```

_See code: [src/commands/bb/auth/delete.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/auth/delete.ts)_

## `bb bb auth list`

List authentication profiles

```
USAGE
  $ bb bb auth list [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List authentication profiles

EXAMPLES
  $ bb bb auth list
```

_See code: [src/commands/bb/auth/list.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/auth/list.ts)_

## `bb bb auth profile`

Set or show the default authentication profile

```
USAGE
  $ bb bb auth profile [--json] [--default <value>]

FLAGS
  --default=<value>  Profile to set as default

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Set or show the default authentication profile

EXAMPLES
  $ bb bb auth profile

  $ bb bb auth profile --default test
```

_See code: [src/commands/bb/auth/profile.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/auth/profile.ts)_

## `bb bb auth test`

Test authentication and connection

```
USAGE
  $ bb bb auth test [--json] [-p <value>]

FLAGS
  -p, --profile=<value>  Authentication profile name

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Test authentication and connection

EXAMPLES
  $ bb bb auth test

  $ bb bb auth test -p prod
```

_See code: [src/commands/bb/auth/test.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/auth/test.ts)_

## `bb bb auth update`

Update Bitbucket authentication

```
USAGE
  $ bb bb auth update -p <value> -t <value> -e <value> -u <value> [--json]

FLAGS
  -e, --email=<value>     (required) Account email
  -p, --profile=<value>   (required) Profile name
  -t, --apiToken=<value>  (required) API Token
  -u, --host=<value>      (required) Bitbucket instance URL

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Update Bitbucket authentication

EXAMPLES
  $ bb bb auth update

  $ bb bb auth update -p test
```

_See code: [src/commands/bb/auth/update.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/auth/update.ts)_

## `bb bb pipeline get WORKSPACE REPOSLUG PIPELINEUUID`

Get details of a specific pipeline

```
USAGE
  $ bb bb pipeline get WORKSPACE REPOSLUG PIPELINEUUID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE     Workspace slug or UUID
  REPOSLUG      Repository slug
  PIPELINEUUID  Pipeline UUID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Get details of a specific pipeline

EXAMPLES
  $ bb bb pipeline get my-workspace my-repo {uuid}
```

_See code: [src/commands/bb/pipeline/get.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pipeline/get.ts)_

## `bb bb pipeline list WORKSPACE REPOSLUG`

List pipelines for a repository

```
USAGE
  $ bb bb pipeline list WORKSPACE REPOSLUG [--page <value>] [--pagelen <value>] [-p <value>] [--sort <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>  Authentication profile name
      --page=<value>     [default: 1] Page number
      --pagelen=<value>  [default: 10] Number of items per page
      --sort=<value>     Sort field (e.g., created_on)
      --toon             Format output as toon

DESCRIPTION
  List pipelines for a repository

EXAMPLES
  $ bb bb pipeline list my-workspace my-repo
```

_See code: [src/commands/bb/pipeline/list.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pipeline/list.ts)_

## `bb bb pipeline trigger WORKSPACE REPOSLUG`

Trigger a pipeline run

```
USAGE
  $ bb bb pipeline trigger WORKSPACE REPOSLUG --branch <value> [--custom <value>] [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>  Authentication profile name
      --branch=<value>   (required) Branch name to run pipeline on
      --custom=<value>   Custom pipeline pattern name
      --toon             Format output as toon

DESCRIPTION
  Trigger a pipeline run

EXAMPLES
  $ bb bb pipeline trigger my-workspace my-repo --branch main

  $ bb bb pipeline trigger my-workspace my-repo --branch main --custom my-pipeline
```

_See code: [src/commands/bb/pipeline/trigger.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pipeline/trigger.ts)_

## `bb bb pr approve WORKSPACE REPOSLUG PULLREQUESTID`

Approve a pull request

```
USAGE
  $ bb bb pr approve WORKSPACE REPOSLUG PULLREQUESTID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Approve a pull request

EXAMPLES
  $ bb bb pr approve my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/approve.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/approve.ts)_

## `bb bb pr comment WORKSPACE REPOSLUG PRID`

Add a comment to a pull request, optionally on a specific file and line

```
USAGE
  $ bb bb pr comment WORKSPACE REPOSLUG PRID --body <value> [--file <value>] [--line <value>] [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug
  PRID       Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --body=<value>     (required) Comment text
      --file=<value>     File path for inline comment
      --line=<value>     Line number for inline comment
      --toon             Format output as toon

DESCRIPTION
  Add a comment to a pull request, optionally on a specific file and line

EXAMPLES
  $ bb bb pr comment my-workspace my-repo 42 --body "Looks good!"

  $ bb bb pr comment my-workspace my-repo 42 --body "Fix this" --file src/foo.ts --line 15
```

_See code: [src/commands/bb/pr/comment.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/comment.ts)_

## `bb bb pr comment-delete WORKSPACE REPOSLUG PRID COMMENTID`

Delete a comment on a pull request

```
USAGE
  $ bb bb pr comment-delete WORKSPACE REPOSLUG PRID COMMENTID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug
  PRID       Pull request ID
  COMMENTID  Comment ID to delete

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Delete a comment on a pull request

EXAMPLES
  $ bb bb pr comment-delete my-workspace my-repo 42 100
```

_See code: [src/commands/bb/pr/comment-delete.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/comment-delete.ts)_

## `bb bb pr comment-reply WORKSPACE REPOSLUG PRID COMMENTID`

Reply to a comment on a pull request

```
USAGE
  $ bb bb pr comment-reply WORKSPACE REPOSLUG PRID COMMENTID --body <value> [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug
  PRID       Pull request ID
  COMMENTID  Comment ID to reply to

FLAGS
  -p, --profile=<value>  Authentication profile name
      --body=<value>     (required) Reply text
      --toon             Format output as toon

DESCRIPTION
  Reply to a comment on a pull request

EXAMPLES
  $ bb bb pr comment-reply my-workspace my-repo 42 100 --body "Thanks for the feedback!"
```

_See code: [src/commands/bb/pr/comment-reply.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/comment-reply.ts)_

## `bb bb pr comment-resolve WORKSPACE REPOSLUG PRID COMMENTID`

Resolve a comment on a pull request

```
USAGE
  $ bb bb pr comment-resolve WORKSPACE REPOSLUG PRID COMMENTID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug
  PRID       Pull request ID
  COMMENTID  Comment ID to resolve

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Resolve a comment on a pull request

EXAMPLES
  $ bb bb pr comment-resolve my-workspace my-repo 42 100
```

_See code: [src/commands/bb/pr/comment-resolve.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/comment-resolve.ts)_

## `bb bb pr comment-update WORKSPACE REPOSLUG PRID COMMENTID`

Update a comment on a pull request

```
USAGE
  $ bb bb pr comment-update WORKSPACE REPOSLUG PRID COMMENTID --body <value> [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug
  PRID       Pull request ID
  COMMENTID  Comment ID to update

FLAGS
  -p, --profile=<value>  Authentication profile name
      --body=<value>     (required) New comment text
      --toon             Format output as toon

DESCRIPTION
  Update a comment on a pull request

EXAMPLES
  $ bb bb pr comment-update my-workspace my-repo 42 100 --body "Updated comment text"
```

_See code: [src/commands/bb/pr/comment-update.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/comment-update.ts)_

## `bb bb pr comments WORKSPACE REPOSLUG PRID`

List comments on a pull request

```
USAGE
  $ bb bb pr comments WORKSPACE REPOSLUG PRID [--page <value>] [--pagelen <value>] [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug
  PRID       Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --page=<value>     [default: 1] Page number
      --pagelen=<value>  [default: 10] Number of items per page
      --toon             Format output as toon

DESCRIPTION
  List comments on a pull request

EXAMPLES
  $ bb bb pr comments my-workspace my-repo 42
```

_See code: [src/commands/bb/pr/comments.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/comments.ts)_

## `bb bb pr create WORKSPACE REPOSLUG`

Create a new pull request

```
USAGE
  $ bb bb pr create WORKSPACE REPOSLUG --destination <value> --source <value> --title <value> [--description
    <value>] [-p <value>] [--reviewers <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>      Authentication profile name
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

_See code: [src/commands/bb/pr/create.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/create.ts)_

## `bb bb pr decline WORKSPACE REPOSLUG PULLREQUESTID`

Decline a pull request

```
USAGE
  $ bb bb pr decline WORKSPACE REPOSLUG PULLREQUESTID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Decline a pull request

EXAMPLES
  $ bb bb pr decline my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/decline.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/decline.ts)_

## `bb bb pr diff WORKSPACE REPOSLUG PULLREQUESTID`

Get the diff for a pull request

```
USAGE
  $ bb bb pr diff WORKSPACE REPOSLUG PULLREQUESTID [-p <value>]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name

DESCRIPTION
  Get the diff for a pull request

EXAMPLES
  $ bb bb pr diff my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/diff.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/diff.ts)_

## `bb bb pr get WORKSPACE REPOSLUG PULLREQUESTID`

Get details of a specific pull request

```
USAGE
  $ bb bb pr get WORKSPACE REPOSLUG PULLREQUESTID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Get details of a specific pull request

EXAMPLES
  $ bb bb pr get my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/get.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/get.ts)_

## `bb bb pr list WORKSPACE REPOSLUG`

List pull requests for a repository

```
USAGE
  $ bb bb pr list WORKSPACE REPOSLUG [--page <value>] [--pagelen <value>] [-p <value>] [--state <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>  Authentication profile name
      --page=<value>     [default: 1] Page number
      --pagelen=<value>  [default: 10] Number of items per page
      --state=<value>    Filter by state (OPEN, MERGED, DECLINED, SUPERSEDED)
      --toon             Format output as toon

DESCRIPTION
  List pull requests for a repository

EXAMPLES
  $ bb bb pr list my-workspace my-repo
```

_See code: [src/commands/bb/pr/list.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/list.ts)_

## `bb bb pr merge WORKSPACE REPOSLUG PULLREQUESTID`

Merge a pull request

```
USAGE
  $ bb bb pr merge WORKSPACE REPOSLUG PULLREQUESTID [--close-source-branch] [-m <value>] [-p <value>] [--strategy
    merge_commit|squash|fast_forward] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -m, --message=<value>      Merge commit message
  -p, --profile=<value>      Authentication profile name
      --close-source-branch  Close source branch after merge
      --strategy=<option>    Merge strategy (merge_commit, squash, fast_forward)
                             <options: merge_commit|squash|fast_forward>
      --toon                 Format output as toon

DESCRIPTION
  Merge a pull request

EXAMPLES
  $ bb bb pr merge my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/merge.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/merge.ts)_

## `bb bb pr unapprove WORKSPACE REPOSLUG PULLREQUESTID`

Remove approval from a pull request

```
USAGE
  $ bb bb pr unapprove WORKSPACE REPOSLUG PULLREQUESTID [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Remove approval from a pull request

EXAMPLES
  $ bb bb pr unapprove my-workspace my-repo 123
```

_See code: [src/commands/bb/pr/unapprove.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/unapprove.ts)_

## `bb bb pr update WORKSPACE REPOSLUG PULLREQUESTID`

Update a pull request

```
USAGE
  $ bb bb pr update WORKSPACE REPOSLUG PULLREQUESTID [--description <value>] [-p <value>] [--title <value>]
    [--toon]

ARGUMENTS
  WORKSPACE      Workspace slug or UUID
  REPOSLUG       Repository slug
  PULLREQUESTID  Pull request ID

FLAGS
  -p, --profile=<value>      Authentication profile name
      --description=<value>  Pull request description
      --title=<value>        Pull request title
      --toon                 Format output as toon

DESCRIPTION
  Update a pull request

EXAMPLES
  $ bb bb pr update my-workspace my-repo 1 --title "Updated title"
```

_See code: [src/commands/bb/pr/update.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/pr/update.ts)_

## `bb bb repo create WORKSPACE REPOSLUG`

Create a new repository

```
USAGE
  $ bb bb repo create WORKSPACE REPOSLUG [--description <value>] [--language <value>] [--private] [-p <value>]
    [--project-key <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>      Authentication profile name
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

_See code: [src/commands/bb/repo/create.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/repo/create.ts)_

## `bb bb repo delete WORKSPACE REPOSLUG`

Delete a repository

```
USAGE
  $ bb bb repo delete WORKSPACE REPOSLUG [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Delete a repository

EXAMPLES
  $ bb bb repo delete my-workspace my-repo
```

_See code: [src/commands/bb/repo/delete.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/repo/delete.ts)_

## `bb bb repo get WORKSPACE REPOSLUG`

Get details of a specific repository

```
USAGE
  $ bb bb repo get WORKSPACE REPOSLUG [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID
  REPOSLUG   Repository slug

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Get details of a specific repository

EXAMPLES
  $ bb bb repo get my-workspace my-repo
```

_See code: [src/commands/bb/repo/get.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/repo/get.ts)_

## `bb bb repo list WORKSPACE`

List repositories in a workspace

```
USAGE
  $ bb bb repo list WORKSPACE [--page <value>] [--pagelen <value>] [-p <value>] [--q <value>] [--role <value>]
    [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID

FLAGS
  -p, --profile=<value>  Authentication profile name
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

_See code: [src/commands/bb/repo/list.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/repo/list.ts)_

## `bb bb workspace get WORKSPACE`

Get details of a specific workspace

```
USAGE
  $ bb bb workspace get WORKSPACE [-p <value>] [--toon]

ARGUMENTS
  WORKSPACE  Workspace slug or UUID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Get details of a specific workspace

EXAMPLES
  $ bb bb workspace get my-workspace
```

_See code: [src/commands/bb/workspace/get.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/workspace/get.ts)_

## `bb bb workspace list`

List all accessible workspaces

```
USAGE
  $ bb bb workspace list [--page <value>] [--pagelen <value>] [-p <value>] [--toon]

FLAGS
  -p, --profile=<value>  Authentication profile name
      --page=<value>     [default: 1] Page number
      --pagelen=<value>  [default: 10] Number of items per page
      --toon             Format output as toon

DESCRIPTION
  List all accessible workspaces

EXAMPLES
  $ bb bb workspace list
```

_See code: [src/commands/bb/workspace/list.ts](https://github.com/hesedcasa/bb/blob/v0.8.0/src/commands/bb/workspace/list.ts)_
<!-- commandsstop -->
