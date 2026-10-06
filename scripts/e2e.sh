#!/usr/bin/env bash
# Runs the end-to-end suite against the live Bitbucket Cloud workspace — twice:
# once through the built standalone CLI, then again through the latest sdkck
# host CLI with this build packed and installed as its @hesed/bb plugin.
#
# The credentials come from Infisical: when they aren't already exported, the
# script re-runs itself under `infisical run`, signed in either by a one-time
# `infisical login` or, in a headless sandbox, by a machine identity's
# INFISICAL_UNIVERSAL_AUTH_CLIENT_ID and INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET.
#
#   npm run test:e2e
#   npm run test:e2e -- --keep            # skip the post-run sweep
#   npm run test:e2e -- --grep "comment"  # extra args go through to mocha
#
# Bitbucket Cloud has no Docker image, so the fixture workspace plays the role
# a disposable container plays in a container-backed suite: the fixture repos
# (named e2e-<run id>-*) are created and deleted around every run.
set -euo pipefail

cd "$(dirname "$0")/.."

# E2E_VIA_INFISICAL stops a second re-exec when Infisical lacks a secret. The
# absolute path matters: $0 may be relative to the directory we just left.
if { [ -z "${BITBUCKET_EMAIL:-}" ] || [ -z "${BITBUCKET_API_TOKEN:-}" ] ||
  [ -z "${E2E_WORKSPACE:-}" ]; } && [ -z "${E2E_VIA_INFISICAL:-}" ] &&
  command -v infisical >/dev/null; then
  infisical_args=(--silent)
  if [ -n "${INFISICAL_UNIVERSAL_AUTH_CLIENT_ID:-}" ]; then
    # The CLI reads the client id and secret from the environment; passing
    # them as flags would put the secret in the process list.
    INFISICAL_TOKEN="$(infisical login --method=universal-auth --silent --plain)"
    export INFISICAL_TOKEN
  fi
  # A machine identity token ignores .infisical.json, so pass its project ID.
  if [ -n "${INFISICAL_TOKEN:-}" ]; then
    infisical_args+=(--projectId "$(node -p "require('./.infisical.json').workspaceId")")
  fi
  E2E_VIA_INFISICAL=1 exec infisical run "${infisical_args[@]}" -- "$PWD/scripts/e2e.sh" "$@"
fi

# The Bitbucket credentials are all the tests need; keep the Infisical ones
# out of their environment.
unset INFISICAL_TOKEN INFISICAL_UNIVERSAL_AUTH_CLIENT_ID INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET

KEEP=0
MOCHA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    *) MOCHA_ARGS+=("$arg") ;;
  esac
done

missing=()
for var in BITBUCKET_EMAIL BITBUCKET_API_TOKEN E2E_WORKSPACE; do
  if [ -z "${!var:-}" ]; then
    missing+=("$var")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "error: missing credentials: ${missing[*]}" >&2
  echo "Check they exist in Infisical's dev environment and that the" >&2
  echo "Infisical CLI is installed and logged in (infisical login), or set" >&2
  echo "INFISICAL_UNIVERSAL_AUTH_CLIENT_ID and _CLIENT_SECRET." >&2
  exit 1
fi

# Pins the fixture prefix for this invocation so the post-run sweep, which is
# a separate process from mocha, can reclaim *this* run's fixtures and not
# only the ones older than an hour.
E2E_RUN_ID="${E2E_RUN_ID:-local-$$}"
export E2E_RUN_ID

# Runs on the way out, including after a failing mocha. A sweep failure leaves
# fixtures in the shared workspace, so it must not be swallowed: it surfaces
# as a non-zero exit unless the tests already failed, in which case that
# status is the more useful one to keep.
# The throwaway sdkck home this script creates, if it got that far. Deliberately
# NOT named SDKCK_HOME: an inherited SDKCK_HOME could point at the developer's
# real sdkck setup, and the EXIT trap must never rm -rf that. This variable only
# ever holds a path this script itself mktemp'd.
SDKCK_E2E_HOME=""

cleanup() {
  local status=$?

  if [ -n "$SDKCK_E2E_HOME" ]; then
    # `npm pack` can fail after `prepack` has already rewritten README.md, so
    # the restore lives here rather than only after the pack.
    if [ -f "$SDKCK_E2E_HOME/README.md.orig" ]; then
      cp "$SDKCK_E2E_HOME/README.md.orig" README.md
    fi
    rm -rf "$SDKCK_E2E_HOME"
  fi

  if [ "$KEEP" -ne 0 ]; then
    echo "==> Leaving fixtures in place (--keep); clean up later with: npm run e2e:sweep"
    exit "$status"
  fi

  echo "==> Sweeping any fixtures left behind"
  if npm run --silent e2e:sweep; then
    exit "$status"
  fi

  echo "error: sweeping fixtures failed; the workspace may still hold e2e repos" >&2
  if [ "$status" -eq 0 ]; then
    exit 1
  fi

  exit "$status"
}
trap cleanup EXIT

run_mocha() {
  # Delegates to the `e2e:mocha` script rather than calling mocha directly, so
  # both entry points share one glob and one timeout.
  # The +expansion guard keeps `set -u` happy with an empty array on bash 3.2.
  npm run --silent e2e:mocha -- ${MOCHA_ARGS[@]+"${MOCHA_ARGS[@]}"}
}

# Records the first failing leg's status. A later leg failing with a different
# status must not overwrite an earlier failure: the script's contract is to
# exit with the first failure it saw.
EXIT_STATUS=0
record_failure() {
  local leg_status=$?
  [ "$EXIT_STATUS" -ne 0 ] || EXIT_STATUS=$leg_status
}

echo "==> Building the CLI"
# The build and the pack below run repository and dependency scripts that never
# need the credentials, so they are stripped there as for the sdkck installs.
env -u BITBUCKET_EMAIL -u BITBUCKET_API_TOKEN -u E2E_WORKSPACE npm run build

echo "==> Running end-to-end tests against workspace ${E2E_WORKSPACE}"
# Both legs always run: a standalone-leg failure says nothing about the packed
# plugin, and vice versa. The `|| record_failure` form keeps `set -e` from
# aborting so the sdkck leg still executes; the first failure becomes the exit
# code.
run_mocha || record_failure

# Second leg: the same suite through the sdkck host CLI, with this build
# installed as its @hesed/bb plugin.
echo "==> Downloading the latest sdkck"
# --no-save resolves "latest" from the registry on every run without touching
# package.json; the binary comes from node_modules/.bin. The install runs with
# the credentials stripped from the environment: a lifecycle script of the
# freshly fetched package is arbitrary code from a mutable release, and never
# needs them.
env -u BITBUCKET_EMAIL -u BITBUCKET_API_TOKEN -u E2E_WORKSPACE npm install --silent --no-save sdkck
export PATH="$PWD/node_modules/.bin:$PATH"

# A throwaway sdkck home keeps the plugin install, its config and its caches
# out of the developer's real sdkck setup; the test side finds it via
# E2E_SDKCK_HOME.
SDKCK_E2E_HOME="$(mktemp -d)"
export E2E_SDKCK_HOME="$SDKCK_E2E_HOME"
SDKCK_DIRS=(
  SDKCK_CACHE_DIR="$SDKCK_E2E_HOME/cache"
  SDKCK_CONFIG_DIR="$SDKCK_E2E_HOME/config"
  SDKCK_DATA_DIR="$SDKCK_E2E_HOME/data"
)

# A fresh home cannot hold the plugin yet; if it does, the leg would test
# whatever is there rather than this build. `plugins inspect` is a host
# command, so the probe cannot itself trigger sdkck's first-use install.
if env "${SDKCK_DIRS[@]}" sdkck plugins inspect @hesed/bb --json >/dev/null 2>&1; then
  echo "error: @hesed/bb is already installed in the throwaway sdkck home" >&2
  exit 1
fi

echo "==> Packing the current build and installing it as an sdkck plugin"
# npm pack runs `prepack`, regenerating oclif.manifest.json and the README —
# the same artifacts the publish workflow ships — so the sdkck leg exercises
# the real install artifact, not just the working tree. Packing straight into
# the throwaway home keeps the tarball out of the repo root; the EXIT trap
# removes it with the rest of the home.
# `oclif readme` stamps the local platform into README.md's usage block, so
# the committed README is backed up here and put back by the EXIT trap rather
# than left modified. `prepack` runs repository scripts and needs no
# credentials, so they are stripped here too.
cp README.md "$SDKCK_E2E_HOME/README.md.orig"
TGZ="$(env -u BITBUCKET_EMAIL -u BITBUCKET_API_TOKEN -u E2E_WORKSPACE \
  npm pack --pack-destination "$SDKCK_E2E_HOME" | tail -n 1)"
cp "$SDKCK_E2E_HOME/README.md.orig" README.md

# Installing here — before any `sdkck bb` invocation — stops sdkck's
# first-use auto-installer from pulling the published @hesed/bb release
# over the build under test. The tarball must be passed as a `file:` URL:
# sdkck resolves any bare path containing a slash as a GitHub org/repo.
# Credentials are stripped here too: the install handles a local tarball and
# needs none, so the mocha legs are the only steps that hold them under sdkck.
env -u BITBUCKET_EMAIL -u BITBUCKET_API_TOKEN -u E2E_WORKSPACE \
  "${SDKCK_DIRS[@]}" sdkck plugins install "file:$SDKCK_E2E_HOME/$TGZ"

# Prove dispatch resolves to the tarball this run packed, not a published
# release the auto-installer could have fetched: the install record sdkck
# writes under the data dir must carry our file: URL. The record is read from
# disk rather than via `sdkck plugins inspect`, which has been observed to die
# on an unsettled top-level await right after loading a freshly installed
# plugin.
grep -Fq "\"file:$SDKCK_E2E_HOME/$TGZ\"" "$SDKCK_E2E_HOME/data/package.json" || {
  echo "error: sdkck did not register the packed tarball as @hesed/bb" >&2
  exit 1
}

echo "==> Running end-to-end tests via sdkck"
E2E_HOST_CLI=sdkck run_mocha || record_failure

exit "$EXIT_STATUS"
