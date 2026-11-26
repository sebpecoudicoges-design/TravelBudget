import unittest

from r8_experiment import candidate_config, compare


class R8ExperimentTest(unittest.TestCase):
    def test_toggles_only_a_known_release_config(self):
        config = "release {\n            minifyEnabled false\nproguardFiles getDefaultProguardFile('proguard-android.txt')\n}"
        expected = config.replace("minifyEnabled false", "minifyEnabled true").replace(
            "proguard-android.txt", "proguard-android-optimize.txt")
        self.assertEqual(candidate_config(config), expected)
        for different in ("", config * 2, expected):
            with self.subTest(different=different), self.assertRaisesRegex(ValueError, "expected baseline"):
                candidate_config(different)

    def artifact(self, size, mapping, sha):
        return {
            "artifact_sha256": sha, "dex_uncompressed_bytes": size,
            "native_uncompressed_bytes_by_abi": {"x86_64": 50},
            "bundle_metadata": {"obfuscation_mapping": mapping, "r8_json": mapping, "native_debug_symbols": False},
        }

    def test_records_reduction_separately_from_scores(self):
        before, after = self.artifact(100, False, "old"), self.artifact(30, True, "new")
        self.assertEqual(compare(before, after), {
            "baseline_dex_uncompressed_bytes": 100, "candidate_dex_uncompressed_bytes": 30,
            "dex_bytes_reduced": 70, "dex_byte_reduction_pct": 70.00, "candidate_mapping_present": True,
            "candidate_r8_json_present": True, "candidate_native_debug_symbols_present": False,
        })

    def test_fails_closed_on_apk_no_mapping_or_no_improvement(self):
        before = self.artifact(100, False, "old")
        for after, expected in [
            ({**self.artifact(30, True, "new"), "bundle_metadata": None}, "mapped candidate"),
            (self.artifact(30, False, "new"), "mapped candidate"),
            (self.artifact(30, True, "old"), "different bundles"),
            (self.artifact(100, True, "new"), "did not reduce"),
            ({**self.artifact(30, True, "new"), "native_uncompressed_bytes_by_abi": {}}, "Native library"),
        ]:
            with self.subTest(expected=expected), self.assertRaisesRegex(ValueError, expected):
                compare(before, after)
