#!/usr/bin/env bash
# EAS build hook (package.json "eas-build-pre-install"). A preview or store build stops here, before anything is
# compiled, when it would ship with a local Supabase address or without the legal links. On EAS's iOS machines
# it also fetches Xcode's Metal toolchain, which the resizer's shaders need (README "Derleme gereksinimleri").
set -euo pipefail

profile="${EAS_BUILD_PROFILE:-}"
problems=()
if [[ "$profile" == "preview" || "$profile" == "production" ]]; then
  url="${EXPO_PUBLIC_SUPABASE_URL:-}"
  if [[ "$url" != https://* ]]; then problems+=("EXPO_PUBLIC_SUPABASE_URL must start with https://"); fi
  if [[ "$url" =~ (127\.0\.0\.1|localhost|10\.0\.2\.2) ]]; then problems+=("EXPO_PUBLIC_SUPABASE_URL points at a local Supabase"); fi
  if [[ -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then problems+=("EXPO_PUBLIC_SUPABASE_ANON_KEY is empty"); fi
  for name in EXPO_PUBLIC_PRIVACY_URL EXPO_PUBLIC_IMPRINT_URL; do
    if [[ "${!name:-}" != https://* ]]; then problems+=("$name must be an https:// link"); fi
  done
fi

if (( ${#problems[@]} > 0 )); then
  printf 'Release configuration of the "%s" build is not ready:\n' "$profile" >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

if [[ "${EAS_BUILD:-}" == "true" && "${EAS_BUILD_PLATFORM:-}" == "ios" ]]; then
  if ! xcrun -sdk iphoneos metal -v >/dev/null 2>&1; then
    xcodebuild -downloadComponent MetalToolchain
  fi
fi
