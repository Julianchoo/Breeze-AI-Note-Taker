"""Prepare/restore an encrypted signing backup; never generate keys or publish releases."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile


def run(command, *, password=None, env=None):
    return subprocess.run(command, input=password, env=env, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, check=True).stdout


def certificate(path, alias, env):
    public_der = run(['keytool', '-exportcert', '-keystore', str(path), '-alias', alias,
                      '-storepass:env', 'BREEZE_KEYSTORE_PASSWORD'], env=env)
    return hashlib.sha256(public_der).hexdigest()


def backup(mode, source, output, manifest):
    password = os.environ.get('ANDROID_SIGNING_BACKUP_PASSWORD', '')
    if len(password) < 32 or '\n' in password or '\r' in password:
        raise ValueError('Set ANDROID_SIGNING_BACKUP_PASSWORD to a strong random passphrase of at least 32 characters')
    if output.exists() or (mode == 'encrypt' and manifest.exists()):
        raise ValueError('Refusing to overwrite an existing key, encrypted backup or manifest')
    env = dict(os.environ, BREEZE_KEYSTORE_PASSWORD=os.environ.get('BREEZE_KEYSTORE_PASSWORD', password))
    with tempfile.TemporaryDirectory(prefix='.breeze-signing-', dir=output.parent) as directory:
        work = Path(directory)
        gpg_home = work / 'gpg'
        gpg_home.mkdir(mode=0o700)
        base = ['gpg', '--homedir', str(gpg_home), '--batch', '--yes', '--pinentry-mode', 'loopback',
                '--no-symkey-cache', '--passphrase-fd', '0']
        passphrase = (password + '\n').encode()
        temporary = work / 'output'
        if mode == 'encrypt':
            alias = os.environ.get('BREEZE_KEY_ALIAS', 'breeze')
            public = dict(formatVersion=1, keyAlias=alias,
                          signingCertificateSha256=certificate(source, alias, env),
                          keystoreSha256=hashlib.sha256(source.read_bytes()).hexdigest())
            run(base + ['--cipher-algo', 'AES256', '--s2k-mode', '3', '--s2k-digest-algo', 'SHA512',
                        '--s2k-count', '65011712', '--output', str(temporary), '--symmetric', str(source)], password=passphrase)
            restored = work / 'roundtrip.p12'
            run(base + ['--output', str(restored), '--decrypt', str(temporary)], password=passphrase)
            if restored.read_bytes() != source.read_bytes():
                raise ValueError('Encrypted backup round-trip verification failed')
            manifest.write_text(json.dumps(public, indent=2) + '\n')
        else:
            public = json.loads(manifest.read_text())
            if public['formatVersion'] != 1:
                raise ValueError('Unsupported backup manifest')
            run(base + ['--output', str(temporary), '--decrypt', str(source)], password=passphrase)
            if hashlib.sha256(temporary.read_bytes()).hexdigest() != public['keystoreSha256']:
                raise ValueError('Backup digest does not match its manifest')
            if certificate(temporary, public['keyAlias'], env) != public['signingCertificateSha256']:
                raise ValueError('Backup signing certificate does not match its manifest')
        temporary.chmod(0o600)
        temporary.replace(output)
    return public['signingCertificateSha256']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['encrypt', 'decrypt'])
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    try:
        print('Verified signing certificate SHA256:', backup(args.mode, args.source, args.output, args.manifest))
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        # Do not print tool arguments, environment values, decrypted bytes or passwords.
        parser.exit(1, f'Signing backup failed: {type(error).__name__}; no replacement key was published\n')
