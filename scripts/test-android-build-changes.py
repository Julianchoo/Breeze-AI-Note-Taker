"""Check APK builds run for native inputs and skip unrelated web changes."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('android_changes', Path(__file__).with_name('android-build-changes.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ChangeTests(unittest.TestCase):
    def test_web_and_documentation_changes_skip_apk(self):
        for path in ['src/app/layout.tsx', 'src/app/api/android/apk/route.ts', 'docs/android.md', 'README.md']:
            self.assertFalse(module.is_android_input(path), path)

    def test_native_and_signing_changes_build_apk(self):
        for path in ['android/app/build.gradle', 'android/app/src/main/res/mipmap/icon.png',
                     '.github/workflows/android-apk.yml', 'scripts/restore-android-signer.sh']:
            self.assertTrue(module.is_android_input(path), path)

    def test_dispatch_always_builds_without_diff(self):
        with patch.object(module.subprocess, 'check_output') as git:
            self.assertTrue(module.detect('workflow_dispatch', 'abc'))
            git.assert_not_called()

    def test_push_diff_uses_exact_before_commit(self):
        with patch.object(module.subprocess, 'check_output', return_value=b'src/app/layout.tsx\0') as git:
            self.assertFalse(module.detect('push', 'abc'))
            git.assert_called_once_with(['git', 'diff', '--name-only', '-z', 'abc', 'HEAD', '--'])

    def test_initial_push_includes_native_project(self):
        with patch.object(module.subprocess, 'check_output', return_value=b'android/app/build.gradle\0') as git:
            self.assertTrue(module.detect('push', '000000'))
            git.assert_called_once_with(['git', 'ls-files', '-z'])


if __name__ == '__main__':
    unittest.main()
