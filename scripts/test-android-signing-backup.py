"""Exercise GnuPG integrity and public-certificate checks with disposable test keys."""
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('android-signing-backup.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.directory.name)
        cls.password = secrets.token_urlsafe(48)
        cls.key = cls.root / 'disposable.p12'
        cls.env = {'ANDROID_SIGNING_BACKUP_PASSWORD': cls.password, 'BREEZE_KEYSTORE_PASSWORD': cls.password,
                   'BREEZE_KEY_ALIAS': 'breeze'}
        subprocess.run(['keytool', '-genkeypair', '-storetype', 'PKCS12', '-keystore', str(cls.key),
                        '-storepass:env', 'BREEZE_KEYSTORE_PASSWORD', '-keypass:env', 'BREEZE_KEYSTORE_PASSWORD',
                        '-alias', 'breeze', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '1',
                        '-dname', 'CN=Disposable signing backup test'],
                       env=dict(os.environ, **cls.env), capture_output=True, check=True)
        cls.encrypted = cls.root / 'key.p12.gpg'
        cls.manifest = cls.root / 'manifest.json'
        with patch.dict(os.environ, cls.env):
            module.backup('encrypt', cls.key, cls.encrypted, cls.manifest)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def test_restore_matches_original_key_and_certificate(self):
        output = self.root / 'restored.p12'
        with patch.dict(os.environ, self.env):
            certificate = module.backup('decrypt', self.encrypted, output, self.manifest)
        self.assertEqual(output.read_bytes(), self.key.read_bytes())
        self.assertEqual(certificate, json.loads(self.manifest.read_text())['signingCertificateSha256'])
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)

    def test_wrong_passphrase_does_not_leave_a_private_key(self):
        output = self.root / 'wrong-password.p12'
        with patch.dict(os.environ, dict(self.env, ANDROID_SIGNING_BACKUP_PASSWORD=secrets.token_urlsafe(48))):
            with self.assertRaises(subprocess.CalledProcessError):
                module.backup('decrypt', self.encrypted, output, self.manifest)
        self.assertFalse(output.exists())

    def test_corrupted_ciphertext_is_rejected(self):
        contents = bytearray(self.encrypted.read_bytes())
        contents[-25] ^= 1
        corrupted = self.root / 'corrupted.gpg'
        corrupted.write_bytes(contents)
        output = self.root / 'corrupted.p12'
        with patch.dict(os.environ, self.env):
            with self.assertRaises(subprocess.CalledProcessError):
                module.backup('decrypt', corrupted, output, self.manifest)
        self.assertFalse(output.exists())

    def test_manifest_certificate_mismatch_is_rejected(self):
        manifest = self.root / 'wrong-certificate.json'
        data = json.loads(self.manifest.read_text())
        data['signingCertificateSha256'] = '0' * 64
        manifest.write_text(json.dumps(data))
        output = self.root / 'wrong-certificate.p12'
        with patch.dict(os.environ, self.env):
            with self.assertRaises(ValueError):
                module.backup('decrypt', self.encrypted, output, manifest)
        self.assertFalse(output.exists())

    def test_existing_key_cannot_be_overwritten(self):
        before = self.key.read_bytes()
        with patch.dict(os.environ, self.env):
            with self.assertRaises(ValueError):
                module.backup('decrypt', self.encrypted, self.key, self.manifest)
        self.assertEqual(self.key.read_bytes(), before)

    def test_weak_passphrase_is_rejected(self):
        with patch.dict(os.environ, dict(self.env, ANDROID_SIGNING_BACKUP_PASSWORD='short')):
            with self.assertRaises(ValueError):
                module.backup('encrypt', self.key, self.root / 'weak.gpg', self.root / 'weak.json')


if __name__ == '__main__':
    unittest.main()
