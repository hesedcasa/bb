#!/usr/bin/env bash
# Runs the end-to-end suite against the live Bitbucket Cloud workspace.
#
# Nothing in this repo loads .env, so export the credentials first:
#
#   set -a; . ./.env; set +a
#   npm run test:e2e
#   npm run test:e2e -- --keep            # skip the post-run sweep
#   npm run test:e2e -- --grep "comment"  # extra args go through to mocha
#
# Bitbucket Cloud has no Docker image, so the fixture workspace plays the role
# a disposable container plays in a container-backed suite: the fixture repos
# (named e2e-<run id>-*) are created and deleted around every run.
set -euo pipefail

cd "$(dirname "$0")/.."

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
  echo "Nothing in this repo loads .env. Run:  set -a; . ./.env; set +a" >&2
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
cleanup() {
  local status=$?

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

echo "==> Building the CLI"
npm run build

echo "==> Running end-to-end tests against workspace ${E2E_WORKSPACE}"
# Delegates to the `e2e:mocha` script rather than calling mocha directly, so
# both entry points share one glob and one timeout.
# The +expansion guard keeps `set -u` happy with an empty array on bash 3.2.
npm run --silent e2e:mocha -- ${MOCHA_ARGS[@]+"${MOCHA_ARGS[@]}"}
