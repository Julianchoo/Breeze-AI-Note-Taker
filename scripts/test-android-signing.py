"""Verify signer recovery never replaces the published signing certificate."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('restore-android-signer.sh').resolve()


class SigningTests(unittest.TestCase):
    def invoke(self, configured='wrong', candidate=None, secret=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['.android', '.gradle', '.config', 'bin', 'sdk/build-tools/35.0.0']:
                (root / name).mkdir(parents=True)
            key = root / '.android/debug.keystore'
            key.write_text(configured)
            if candidate:
                (root / '.gradle/recovered.keystore').write_text(candidate)
            commands = {
                'gradle': '#!/bin/bash\nexit 0\n',
                'gh': '#!/bin/bash\nexit 0\n',
                'keytool': '''#!/bin/bash
while [ "$#" -gt 0 ]; do
 if [ "$1" = -keystore ]; then cat "$2"; exit; fi
 shift
done
exit 1
''',
                'openssl': '#!/bin/bash\nprintf "SHA256 Fingerprint=%s\\n" "$(cat)"\n',
            }
            for name, body in commands.items():
                path = root / 'bin' / name
                path.write_text(body)
                path.chmod(0o755)
            signer = root / 'sdk/build-tools/35.0.0/apksigner'
            signer.write_text('#!/bin/bash\necho "Signer #1 certificate SHA-256 digest: original"\n')
            signer.chmod(0o755)
            env_file = root / 'env'
            env_file.touch()
            env = dict(os.environ, HOME=str(root), PATH=f'{root}/bin:{os.environ["PATH"]}',
                       ANDROID_HOME=str(root / 'sdk'), GITHUB_REPOSITORY='owner/repo',
                       GITHUB_ENV=str(env_file), BREEZE_KEYSTORE_PATH=str(key),
                       BREEZE_KEY_ALIAS='androiddebugkey', BREEZE_KEYSTORE_PASSWORD='android',
                       BREEZE_SIGNING_FROM_SECRET='true' if secret else '')
            result = subprocess.run(['bash', str(SCRIPT)], env=env, capture_output=True, text=True)
            saved = root / '.android/breeze-distribution.keystore'
            return result, saved.read_text() if saved.exists() else None

    def test_selected_original_key_is_persisted(self):
        result, key = self.invoke(configured='original')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(key, 'original')

    def test_candidate_original_key_is_recovered(self):
        result, key = self.invoke(candidate='original')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(key, 'original')

    def test_mismatched_keys_cannot_rotate_release(self):
        result, key = self.invoke(candidate='other')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('refusing key rotation', result.stdout)
        self.assertIsNone(key)

    def test_secret_key_is_not_copied_to_cache(self):
        result, key = self.invoke(configured='original', secret=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsNone(key)


if __name__ == '__main__':
    unittest.main()
