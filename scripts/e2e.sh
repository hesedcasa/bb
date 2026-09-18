#!/usr/bin/env bash
# Runs the end-to-end suite against the live Bitbucket Cloud workspace — twice:
# once through the built standalone CLI, then again through the latest sdkck
# host CLI with this build packed and installed as its @hesed/bb plugin.
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

  if [ -n "${SDKCK_HOME:-}" ]; then
    rm -rf "$SDKCK_HOME"
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

echo "==> Building the CLI"
npm run build

run_mocha() {
  # Delegates to the `e2e:mocha` script rather than calling mocha directly, so
  # both entry points share one glob and one timeout.
  # The +expansion guard keeps `set -u` happy with an empty array on bash 3.2.
  npm run --silent e2e:mocha -- ${MOCHA_ARGS[@]+"${MOCHA_ARGS[@]}"}
}

echo "==> Running end-to-end tests against workspace ${E2E_WORKSPACE}"
run_mocha

# Second leg: the same suite through the sdkck host CLI, with this build
# installed as its @hesed/bb plugin.
echo "==> Downloading the latest sdkck"
# --no-save resolves "latest" from the registry on every run without touching
# package.json; the binary comes from node_modules/.bin.
npm install --silent --no-save sdkck
export PATH="$PWD/node_modules/.bin:$PATH"

# A throwaway sdkck home keeps the plugin install, its config and its caches
# out of the developer's real sdkck setup; the test side finds it via
# E2E_SDKCK_HOME.
SDKCK_HOME="$(mktemp -d)"
export E2E_SDKCK_HOME="$SDKCK_HOME"

echo "==> Packing the current build and installing it as an sdkck plugin"
# npm pack runs `prepack`, regenerating oclif.manifest.json and the README —
# the same artifacts the publish workflow ships — so the sdkck leg exercises
# the real install artifact, not just the working tree. Packing straight into
# the throwaway home keeps the tarball out of the repo root; the EXIT trap
# removes it with the rest of the home.
TGZ="$(npm pack --pack-destination "$SDKCK_HOME" | tail -n 1)"

# Installing here — before any `sdkck bb` invocation — stops sdkck's
# first-use auto-installer from pulling the published @hesed/bb release over
# the build under test. The tarball must be passed as a `file:` URL: sdkck
# resolves any bare path containing a slash as a GitHub org/repo.
SDKCK_CACHE_DIR="$SDKCK_HOME/cache" \
SDKCK_CONFIG_DIR="$SDKCK_HOME/config" \
SDKCK_DATA_DIR="$SDKCK_HOME/data" \
  sdkck plugins install "file:$SDKCK_HOME/$TGZ"

echo "==> Running end-to-end tests via sdkck"
E2E_HOST_CLI=sdkck run_mocha
