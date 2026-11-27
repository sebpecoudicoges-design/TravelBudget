import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from startup_memory import PACKAGE, read_snapshot, summarize


class StartupMemoryTest(unittest.TestCase):
    def test_main_process_totals_are_read_without_relabeling_the_metric(self):
        sample = f"** MEMINFO in pid 42 [{PACKAGE}] **\n TOTAL PSS: 120000 TOTAL RSS: 280000 TOTAL SWAP PSS: 92\n"
        self.assertEqual(read_snapshot(sample, 42), {"total_pss_kib": 120000, "total_rss_kib": 280000})
        for invalid in (sample.replace(PACKAGE, "other.application"), sample.replace("42", "43"), sample * 2):
            with self.assertRaises(ValueError):
                read_snapshot(invalid, 42)

    def test_samples_are_required_and_reported_instead_of_inferring_percentiles(self):
        with TemporaryDirectory() as temp:
            path = Path(temp)
            with self.assertRaises(ValueError):
                summarize(path)
            for variant in ("baseline", "r8"):
                for index, measure in enumerate((50, 30, 40), start=1):
                    (path / f"{variant}-{index}.json").write_text(json.dumps(
                        {"total_pss_kib": measure, "total_rss_kib": measure * 2}
                    ))
            result = summarize(path)["variants"]["r8"]
            self.assertEqual(result["median_total_pss_kib"], 40)
            self.assertEqual(result["median_total_rss_kib"], 80)
            self.assertEqual(len(result["samples"]), 3)
