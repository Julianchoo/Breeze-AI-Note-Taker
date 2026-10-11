"""Exercise release safeguards without contacting GitHub or requiring an Android SDK."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('publish-android-release.sh').resolve()


class PublicationTests(unittest.TestCase):
    def invoke(self, certificate='same', previous_code=101, version_code=102, assets=('breeze.apk', 'android-release.json')):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'build-tools/35.0.0').mkdir(parents=True)
            signer = root / 'build-tools/35.0.0/apksigner'
            signer.write_text("#!/bin/bash\necho \"Signer #1 certificate SHA-256 digest: $(cat \"${@: -1}\")\"\n")
            signer.chmod(0o755)
            aapt = root / 'build-tools/35.0.0/aapt'
            aapt.write_text("#!/bin/bash\necho \"package: name='com.breeze.app' versionCode='$PREVIOUS_CODE'\"\n")
            aapt.chmod(0o755)
            apk = root / 'new.apk' 
            apk.write_text(certificate)
            gh = root / 'gh'
            gh.write_text('''#!/bin/bash
set -eu
if [ "$1 $2" = 'release view' ]; then printf '%s' "$ASSETS_JSON"; exit 0; fi
if [ "$1 $2" = 'release download' ]; then
  asset=''; dir=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --pattern) asset="$2"; shift;;
      --dir) dir="$2"; shift;;
    esac
    shift
  done
  if [ "$asset" = breeze.apk ]; then printf same > "$dir/$asset";
  else printf '%s' "$PREVIOUS_MANIFEST" > "$dir/$asset"; fi
  exit 0
fi
if [ "$1 $2" = 'release upload' ]; then
  case "$4" in
    */breeze.apk) cp "$4" "$PUBLISHED_APK";;
    */android-release.json) cp "$4" "$PUBLISHED_MANIFEST";;
    *) exit 98;;
  esac
  exit 0
fi
exit 99
''')
            gh.chmod(0o755)
            env = dict(os.environ, PATH=f'{root}:{os.environ["PATH"]}', ANDROID_HOME=str(root),
                       GITHUB_REPOSITORY='owner/repo', GITHUB_SHA='abc123',
                       PREVIOUS_CODE=str(previous_code), ASSETS_JSON=json.dumps({'assets':[{'name': a} for a in assets]}),
                       PREVIOUS_MANIFEST=json.dumps({'versionCode':previous_code,'signingCertificateSha256':'same','sha256':hashlib.sha256(b'same').hexdigest()}), PUBLISHED_APK=str(root / 'published.apk'),
                       PUBLISHED_MANIFEST=str(root / 'published.json'))
            result = subprocess.run(['bash', str(SCRIPT), str(apk), str(version_code), '1.0.2'],
                                    env=env, capture_output=True, text=True)
            manifest = json.loads((root / 'published.json').read_text()) if (root / 'published.json').exists() else None
            return result, manifest

    def test_matching_signer_and_increasing_version_publish_manifest(self):
        result, manifest = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(manifest['versionCode'], 102)
        self.assertEqual(manifest['signingCertificateSha256'], 'same')
        self.assertEqual(manifest['commit'], 'abc123')
        self.assertEqual(len(manifest['sha256']), 64)

    def test_changed_signer_refuses_overwrite(self):
        result, manifest = self.invoke(certificate='different')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Signing certificate changed', result.stdout + result.stderr)
        self.assertIsNone(manifest)

    def test_same_or_older_version_refuses_overwrite(self):
        for version in [100, 101]:
            result, manifest = self.invoke(version_code=version)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Version code must increase', result.stdout + result.stderr)
            self.assertIsNone(manifest)

    def test_empty_release_recovers_first_upload(self):
        result, manifest = self.invoke(assets=())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsNotNone(manifest)

    def test_apk_only_same_binary_recovers_metadata(self):
        result, manifest = self.invoke(assets=('breeze.apk',), version_code=101)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(manifest['versionCode'], 101)

    def test_apk_only_changed_signer_and_old_version_fail(self):
        for args in [{'certificate':'different'}, {'version_code':100}]:
            result, manifest = self.invoke(assets=('breeze.apk',), **args)
            self.assertNotEqual(result.returncode, 0)
            self.assertIsNone(manifest)

    def test_manifest_only_identical_binary_restores_apk(self):
        result, manifest = self.invoke(assets=('android-release.json',), version_code=101)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsNotNone(manifest)

    def test_manifest_only_changed_signer_fails(self):
        result, manifest = self.invoke(assets=('android-release.json',), certificate='different')
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(manifest)


if __name__ == '__main__':
    unittest.main()
