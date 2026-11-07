#!/usr/bin/env bash
# Live verification of `bb repo clone` against Bitbucket Cloud.
# Runs under `infisical run` (BITBUCKET_EMAIL, BITBUCKET_API_TOKEN, E2E_WORKSPACE).
# Never prints secret values. Temporary file — deleted after the run.
set -euo pipefail
cd /home/user/repo

export XDG_CONFIG_HOME=/tmp/bb-live-config
rm -rf "$XDG_CONFIG_HOME"
mkdir -p "$XDG_CONFIG_HOME/bb"

PROFILE_FILE="$XDG_CONFIG_HOME/bb/bb-config.json"
umask 077
cat > "$PROFILE_FILE" <<EOF
{"defaultProfile":"default","profiles":{"default":{"apiToken":"$BITBUCKET_API_TOKEN","email":"$BITBUCKET_EMAIL"}}}
EOF

echo "== profile written (mode $(stat -c %a "$PROFILE_FILE"))"
REPO="bb-clone-e2e-check-$(date +%s)"
DEST_CUSTOM="/tmp/bb-live-clone-custom"

cleanup() {
  node bin/run.js bb repo delete "$E2E_WORKSPACE" "$REPO" -p default >/dev/null 2>&1 || true
  rm -rf "$DEST_CUSTOM"
}
trap cleanup EXIT

echo "== create private repository $REPO"
node bin/run.js bb repo create "$E2E_WORKSPACE" "$REPO" --private -p default >/dev/null
echo "created"

echo "== authenticated clone (default destination)"
CLONE_ERR=$(mktemp)
if ! node bin/run.js bb repo clone "$E2E_WORKSPACE" "$REPO" -p default 2>"$CLONE_ERR"; then
  echo "FAIL: authenticated clone returned non-zero"
  cat "$CLONE_ERR"
  exit 1
fi
if [ ! -d "$REPO/.git" ]; then echo "FAIL: default destination missing"; exit 1; fi
if grep -q "$BITBUCKET_API_TOKEN" "$REPO/.git/config"; then echo "FAIL: token in .git/config"; exit 1; fi
echo "remote: $(git -C "$REPO" config --get remote.origin.url)"
echo "cloned into default destination OK, token absent from .git/config"
rm -rf "$REPO"

echo "== authenticated clone (custom destination)"
if ! node bin/run.js bb repo clone "$E2E_WORKSPACE" "$REPO" "$DEST_CUSTOM" -p default >/dev/null 2>"$CLONE_ERR"; then
  echo "FAIL: custom-destination clone returned non-zero"
  cat "$CLONE_ERR"
  exit 1
fi
if [ ! -d "$DEST_CUSTOM/.git" ]; then echo "FAIL: custom destination missing"; exit 1; fi
if grep -q "$BITBUCKET_API_TOKEN" "$DEST_CUSTOM/.git/config"; then echo "FAIL: token in custom .git/config"; exit 1; fi
echo "cloned into custom destination OK, token absent from .git/config"
rm -rf "$DEST_CUSTOM"

echo "== authenticated clone rejects a wrong token non-interactively"
cat > "$PROFILE_FILE" <<EOF
{"defaultProfile":"default","profiles":{"default":{"apiToken":"definitely-wrong-token","email":"$BITBUCKET_EMAIL"}}}
EOF
set +e
OUT=$(node bin/run.js bb repo clone "$E2E_WORKSPACE" "$REPO" "$DEST_CUSTOM" -p default 2>"$CLONE_ERR")
STATUS=$?
set -e
echo "exit=$STATUS (expected 1)"
echo "stdout: $OUT"
if [ "$STATUS" -eq 0 ]; then echo "FAIL: wrong-token clone unexpectedly succeeded"; exit 1; fi
if echo "$OUT" | grep -q "definitely-wrong-token"; then echo "FAIL: token leaked into output"; exit 1; fi
if grep -q "definitely-wrong-token" "$CLONE_ERR"; then echo "FAIL: token leaked into stderr"; exit 1; fi
rm -rf "$DEST_CUSTOM"

echo "== ssh protocol selection (no credential injection; ssh auth expected to fail here)"
cat > "$PROFILE_FILE" <<EOF
{"defaultProfile":"default","profiles":{"default":{"apiToken":"$BITBUCKET_API_TOKEN","email":"$BITBUCKET_EMAIL"}}}
EOF
set +e
OUT=$(node bin/run.js bb repo clone "$E2E_WORKSPACE" "$REPO" "$DEST_CUSTOM" -p default --protocol ssh 2>"$CLONE_ERR")
STATUS=$?
set -e
echo "exit=$STATUS"
if grep -q "$BITBUCKET_API_TOKEN" "$CLONE_ERR" || echo "$OUT" | grep -q "$BITBUCKET_API_TOKEN"; then
  echo "FAIL: token leaked in ssh attempt"
  exit 1
fi
echo "ssh attempt ran without credential injection (token absent from output)"
rm -rf "$DEST_CUSTOM"

echo "== delete repository"
node bin/run.js bb repo delete "$E2E_WORKSPACE" "$REPO" -p default >/dev/null
echo "deleted"

echo "== ALL LIVE CHECKS PASSED"
