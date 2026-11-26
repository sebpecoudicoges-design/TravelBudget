from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import warnings
import zipfile

from dex_inventory import inspect


class DexInventoryTest(unittest.TestCase):
    def package(self, directory, name, entries):
        path = Path(directory) / name
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for key, value in entries:
                archive.writestr(key, value)
        return path

    def test_all_modules_and_uncompressed_size_only(self):
        with TemporaryDirectory() as directory:
            path = self.package(directory, "test.aab", [
                ("BundleConfig.pb", b"config"),
                ("base/manifest/AndroidManifest.xml", b"manifest"),
                ("base/dex/classes.dex", b"a" * 1000),
                ("base/dex/classes2.dex", b"b" * 100),
                ("feature/dex/classes.dex", b"c" * 50),
                ("base/assets/sample/classes.dex", b"x" * 5000),
                ("base/lib/arm64-v8a/libsample.so", b"x" * 300),
                ("feature/lib/arm64-v8a/libfeature.so", b"x" * 200),
                ("base/lib/x86_64/libsample.so", b"x" * 120),
                ("BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map", b"map"),
                ("BUNDLE-METADATA/com.android.tools.build.profiles/r8.json", b"{}"),
                ("BUNDLE-METADATA/com.android.tools.build.debugsymbols/arm64-v8a/libsample.so.sym", b"sym"),
            ])
            result = inspect(path)
        self.assertEqual(result["dex_uncompressed_bytes"], 1150)
        self.assertEqual(len(result["dex"]), 3)
        self.assertEqual(result["native_uncompressed_bytes_by_abi"], {"arm64-v8a": 500, "x86_64": 120})
        self.assertTrue(all(result["bundle_metadata"].values()))
        self.assertEqual(len(result["artifact_sha256"]), 64)

    def test_apk_and_no_bundle_metadata(self):
        with TemporaryDirectory() as directory:
            path = self.package(directory, "test.apk", [
                ("AndroidManifest.xml", b"manifest"), ("classes.dex", b"abc"),
                ("assets/classes2.dex", b"ignore"),
            ])
            result = inspect(path)
        self.assertEqual(result["dex_uncompressed_bytes"], 3)
        self.assertIsNone(result["bundle_metadata"])

    def test_reject_impostor_or_empty_dex(self):
        with TemporaryDirectory() as directory:
            for entries, message in [
                ([("classes.dex", b"abc")], "manifest"),
                ([("AndroidManifest.xml", b"manifest"), ("classes.dex", b"")], "DEX entries"),
            ]:
                with self.subTest(message=message):
                    with self.assertRaisesRegex(ValueError, message):
                        inspect(self.package(directory, "test.apk", entries))

    def test_reject_duplicate_entries(self):
        with TemporaryDirectory() as directory, warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            path = self.package(directory, "test.apk", [
                ("AndroidManifest.xml", b"manifest"),
                ("classes.dex", b"abc"),
                ("classes.dex", b"def"),
            ])
            with self.assertRaisesRegex(ValueError, "duplicate"):
                inspect(path)


if __name__ == "__main__":
    unittest.main()
