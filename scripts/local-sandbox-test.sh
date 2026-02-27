#!/usr/bin/env bash
set -euo pipefail

# Local sandbox testing script.
# Usage: ./scripts/local-sandbox-test.sh [docker|podman] [-- extra-llxprt-args...]
#
# Examples:
#   ./scripts/local-sandbox-test.sh              # defaults to podman
#   ./scripts/local-sandbox-test.sh docker
#   ./scripts/local-sandbox-test.sh podman -- --profile-load synthetic "write me a haiku"

ENGINE="${1:-podman}"
shift || true

# Consume optional "--" separator
if [[ "${1:-}" == "--" ]]; then
  shift
fi

case "${ENGINE}" in
  docker|podman) ;;
  *)
    echo "Usage: ${0} [docker|podman] [-- extra-llxprt-args...]" >&2
    exit 1
    ;;
esac

if ! command -v "${ENGINE}" >/dev/null 2>&1; then
  echo "Error: ${ENGINE} not found in PATH" >&2
  exit 1
fi

if ! command -v llxprt >/dev/null 2>&1; then
  echo "Error: llxprt not found in PATH (npm install -g @vybestack/llxprt-code)" >&2
  exit 1
fi

SANDBOX_IMAGE_REPO="ghcr.io/vybestack/llxprt-code/sandbox"

resolve_sandbox_version() {
  local ver
  ver=$(npm ls -g @vybestack/llxprt-code --depth=0 --json 2>/dev/null \
    | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1)
  if [[ -n "${ver}" ]]; then
    echo "${ver}"
    return
  fi
  echo "Could not detect installed version, falling back to latest release" >&2
  gh release list --repo vybestack/llxprt-code --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null \
    | sed 's/^v//'
}

VERSION=$(resolve_sandbox_version)
if [[ -z "${VERSION}" ]]; then
  echo "Error: could not resolve sandbox version" >&2
  exit 1
fi
SANDBOX_IMAGE="${SANDBOX_IMAGE_REPO}:${VERSION}"

echo "Engine:        ${ENGINE}" >&2
echo "Sandbox image: ${SANDBOX_IMAGE}" >&2
echo "" >&2

LLXPRT_SANDBOX="${ENGINE}" \
SANDBOX_FLAGS="--cpus=2 --memory=12g --pids-limit=256" \
exec llxprt --sandbox-image "${SANDBOX_IMAGE}" "$@"
