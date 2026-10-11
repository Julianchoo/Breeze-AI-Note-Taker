#!/usr/bin/env bash
set -euo pipefail
apk=${1:?APK path required}
# Export only the public certificate: no private key or password enters output.
expected=$(keytool -exportcert -rfc -keystore "$BREEZE_KEYSTORE_PATH" -alias "$BREEZE_KEY_ALIAS" -storepass:env BREEZE_KEYSTORE_PASSWORD |
  openssl x509 -noout -fingerprint -sha256 | cut -d= -f2 | tr -d ':' | tr '[:upper:]' '[:lower:]')
actual=$("$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "$apk" |
  sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
echo "Expected signing certificate SHA256: $expected"
echo "APK signing certificate SHA256: $actual"
[[ -n "$expected" && "$expected" == "$actual" ]] || {
  echo 'APK did not use the configured persistent signing key; refusing upload.'
  exit 1
}
