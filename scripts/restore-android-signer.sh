#!/usr/bin/env bash
set -euo pipefail
# Diagnose AGP's default path as well as the explicitly selected persistent key.
env -u BREEZE_KEYSTORE_PATH gradle --no-daemon signingReport
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
if ! gh release view android-latest --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  echo 'No released signer available to compare; publication still validates release state.'
  exit 0
fi
gh release download android-latest --repo "$GITHUB_REPOSITORY" --pattern breeze.apk --dir "$work"
released=$("$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "$work/breeze.apk" |
  sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
echo "Released signing certificate SHA256: $released"
fingerprint() {
  keytool -exportcert -rfc -keystore "$1" -alias "$BREEZE_KEY_ALIAS" -storepass:env BREEZE_KEYSTORE_PASSWORD 2>/dev/null |
    openssl x509 -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2 | tr -d ':' | tr '[:upper:]' '[:lower:]'
}
selected=$(fingerprint "$BREEZE_KEYSTORE_PATH" || true)
echo "Configured key: $BREEZE_KEYSTORE_PATH; certificate SHA256: $selected"
persist_recovered() {
  # Secret-backed keys never enter Actions caches.
  if [[ "${BREEZE_SIGNING_FROM_SECRET:-}" == true ]]; then return; fi
  target="$HOME/.android/breeze-distribution.keystore"
  mkdir -p "$HOME/.android"
  if [[ "$1" != "$target" ]]; then cp "$1" "$target"; fi
  echo "BREEZE_KEYSTORE_PATH=$target" >> "$GITHUB_ENV"
}
if [[ -n "$released" && "$selected" == "$released" ]]; then
  persist_recovered "$BREEZE_KEYSTORE_PATH"
  exit 0
fi
# A restored Gradle cache may contain a default signer from the initial build.
while IFS= read -r candidate; do
  digest=$(fingerprint "$candidate" || true)
  echo "Candidate key: $candidate; certificate SHA256: $digest"
  if [[ -n "$released" && "$digest" == "$released" ]]; then
    export BREEZE_KEYSTORE_PATH="$candidate"
    echo "BREEZE_KEYSTORE_PATH=$candidate" >> "$GITHUB_ENV"
    echo 'Recovered the existing released signer; persisting only the matching key.'
    persist_recovered "$candidate"
    exit 0
  fi
done < <(find "$HOME/.gradle" "$HOME/.android" "$HOME/.config" -type f \( -name '*.keystore' -o -name '*.jks' \) 2>/dev/null || true)
echo 'Original released signing key is not present. Restore its private backup; refusing key rotation.'
exit 1
