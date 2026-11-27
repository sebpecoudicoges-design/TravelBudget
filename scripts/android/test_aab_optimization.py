import unittest

from aab_optimization import summarize


def report(**fields):
    return {"results": [{"optimization": {"bundleAnalysisResult": {
        "agpVersion": "8.13.0", "uncompressedDexSizeBytes": "1000", **fields,
    }}}]}


class AnalyzeTest(unittest.TestCase):
    def test_r8_metrics_are_distinct(self):
        data = {"stats": {"optimizationRatio": .71, "obfuscationRatio": .25, "shrinkingRatio": .53},
                "r8DexChecksumStatus": "EXACT_MATCH"}
        result = summarize(report(r8Json=data), 1000)
        self.assertEqual(result["r8_metadata_scores"], {
            "optimization_pct": 71., "obfuscation_pct": 25., "shrinking_pct": 53.,
        })
        self.assertEqual(result["r8_dex_checksum_status"], "EXACT_MATCH")

    def test_fallback_is_not_an_r8_score(self):
        result = summarize(report(mappingObfuscationRatio=.7), 1000)
        self.assertIsNone(result["r8_metadata_scores"]["obfuscation_pct"])
        self.assertEqual(result["mapping_obfuscation_ratio"], .7)

    def test_conflicting_size_or_invalid_values_are_rejected(self):
        with self.assertRaises(ValueError):
            summarize(report(), 99)
        for bad in (1.1, float("nan"), True):
            with self.assertRaises(ValueError):
                summarize(report(r8Json={"stats": {"shrinkingRatio": bad}}), 1000)
