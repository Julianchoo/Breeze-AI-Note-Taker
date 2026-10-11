"""Detect changes to native Android inputs, without running PR-provided shell text."""
import os
from pathlib import PurePosixPath
import subprocess

EXACT_INPUTS = {
    '.github/workflows/android-apk.yml',
    'scripts/android-build-changes.py',
    'scripts/test-android-build-changes.py',
    'scripts/publish-android-release.sh',
    'scripts/restore-android-signer.sh',
    'scripts/verify-android-signing.sh',
    'scripts/test-android-publication.py',
    'scripts/test-android-signing.py',
}


def is_android_input(path):
    return path in EXACT_INPUTS or PurePosixPath(path).parts[:1] == ('android',)


def detect(event, base):
    if event == 'workflow_dispatch':
        return True
    if not base or set(base) == {'0'}:
        # Initial push: evaluate all tracked inputs, including the native project.
        command = ['git', 'ls-files', '-z']
    else:
        command = ['git', 'diff', '--name-only', '-z', base, 'HEAD', '--']
    paths = subprocess.check_output(command).decode('utf-8', errors='surrogateescape').split('\0')
    return any(is_android_input(path) for path in paths)


if __name__ == '__main__':
    changed = detect(os.environ['CHANGE_EVENT'], os.environ.get('CHANGE_BASE', ''))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write(f'android_changed={str(changed).lower()}\n')
