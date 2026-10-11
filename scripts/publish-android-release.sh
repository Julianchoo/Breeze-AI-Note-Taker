#!/usr/bin/env bash
set -euo pipefail
# Run only after web and Android verification, on the default branch.
apk=${1:?APK path required}
version_code=${2:?Version code required}
version_name=${3:?Version name required}
repo=${GITHUB_REPOSITORY:?}
tag=android-latest
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
signer() {
  "$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "$1" |
    sed -n 's/^Signer #1 certificate SHA-256 digest: //p'
}
certificate=$(signer "$apk")
[[ -n "$certificate" ]] || { echo 'Cannot identify APK signing certificate'; exit 1; }
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  gh release view "$tag" --repo "$repo" --json assets > "$work/assets.json"
  for asset in breeze.apk android-release.json; do
    if python3 - "$work/assets.json" "$asset" <<'PYASSET'
import json,sys
sys.exit(0 if any(a['name']==sys.argv[2] for a in json.load(open(sys.argv[1]))['assets']) else 1)
PYASSET
    then gh release download "$tag" --repo "$repo" --pattern "$asset" --dir "$work"; fi
  done
  if [[ -f "$work/breeze.apk" ]]; then
    previous=$(signer "$work/breeze.apk")
    [[ "$certificate" == "$previous" ]] || {
      echo 'Signing certificate changed. Restore the original key; refusing to break updates.'
      exit 1
    }
  fi
  # Empty first releases and interrupted uploads can recover, preserving every available anchor.
  python3 - "$apk" "$work" "$certificate" "$version_code" "$ANDROID_HOME" <<'PYVERIFY'
import hashlib,json,pathlib,re,subprocess,sys
apk,work,certificate,code,sdk=sys.argv[1:]
work=pathlib.Path(work); code=int(code)
def digest(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
previous_apk=work/'breeze.apk'; metadata=work/'android-release.json'
if metadata.exists():
    previous=json.loads(metadata.read_text())
    if certificate != previous['signingCertificateSha256']:
        sys.exit('Signing certificate changed. Restore the original key.')
    old_code=int(previous['versionCode'])
    # If the APK upload vanished, an identical binary can restore it without incrementing.
    identical_restore=(not previous_apk.exists() and code==old_code and digest(apk)==previous['sha256'])
    if not (code>old_code or identical_restore): sys.exit('Version code must increase')
if previous_apk.exists():
    badging=subprocess.check_output([sdk+'/build-tools/35.0.0/aapt','dump','badging',str(previous_apk)],text=True)
    match=re.search(r"versionCode='(\d+)'",badging)
    if not match: sys.exit('Cannot identify existing APK version code')
    old_code=int(match.group(1))
    identical_restore=(code==old_code and digest(apk)==digest(previous_apk))
    if not (code>old_code or identical_restore): sys.exit('Version code must increase')
PYVERIFY
else
  # Distinguish a missing release from failed authentication/network calls.
  gh api "repos/$repo/releases?per_page=100" > "$work/releases.json"
  python3 - "$work/releases.json" <<'PY'
import json,sys
assert not any(r['tag_name'] == 'android-latest' for r in json.load(open(sys.argv[1])))
PY
  gh release create "$tag" --repo "$repo" --target "$GITHUB_SHA" --title 'Breeze para Android' --notes 'APK personal para Android. Instalá breeze.apk. Consultá docs/android.md para grabación, actualizaciones y mantenimiento.'
fi
cp "$apk" "$work/breeze.apk"
export APK_PATH="$work/breeze.apk" VERSION_CODE="$version_code" VERSION_NAME="$version_name" SIGNING_SHA256="$certificate"
python3 - "$work/android-release.json" <<'PY'
import hashlib,json,os,sys
from datetime import datetime,timezone
payload=dict(versionCode=int(os.environ['VERSION_CODE']),versionName=os.environ['VERSION_NAME'],
    sha256=hashlib.sha256(open(os.environ['APK_PATH'],'rb').read()).hexdigest(),
    signingCertificateSha256=os.environ['SIGNING_SHA256'],commit=os.environ['GITHUB_SHA'],
    publishedAt=datetime.now(timezone.utc).isoformat(),
    downloadUrl=f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/releases/download/android-latest/breeze.apk")
with open(sys.argv[1],'w') as f: json.dump(payload,f,indent=2); f.write('\n')
PY
# GitHub assets are replaced individually; metadata is uploaded last.
gh release upload "$tag" "$work/breeze.apk" --repo "$repo" --clobber
gh release upload "$tag" "$work/android-release.json" --repo "$repo" --clobber
