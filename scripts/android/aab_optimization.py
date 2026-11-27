"""Report Android CLI AAB scores without substituting proxy measurements."""
import argparse
import json
from pathlib import Path

from dex_inventory import inspect


def summarize(report: dict, size: int) -> dict:
    results = report["results"]
    if len(results) != 1:
        raise ValueError("Exactly one AAB must be analyzed")
    item = results[0]["optimization"]["bundleAnalysisResult"]
    if int(item["uncompressedDexSizeBytes"]) != size:
        raise ValueError("Android CLI and ZIP inventory disagree on DEX size")
    r8 = item.get("r8Json") or {}
    stats = r8.get("stats") or {}
    scores = {}
    for kind in ("optimization", "obfuscation", "shrinking"):
        ratio = stats.get(f"{kind}Ratio")
        if ratio is not None and (type(ratio) not in (int, float) or not 0 <= ratio <= 1):
            raise ValueError(f"Invalid {kind} ratio")
        scores[f"{kind}_pct"] = None if ratio is None else round(ratio * 100, 4)
    return {
        "agp_version": item.get("agpVersion"),
        "uncompressed_dex_bytes": size,
        "r8_version": r8.get("version"),
        "r8_dex_checksum_status": r8.get("r8DexChecksumStatus"),
        "r8_metadata_scores": scores,
        "mapping_obfuscation_ratio": item.get("mappingObfuscationRatio"),
        "dex_heuristic_obfuscation_ratio": item.get("dexHeuristicObfuscationRatio"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    print(json.dumps(summarize(json.loads(args.report.read_text()), inspect(args.bundle)["dex_uncompressed_bytes"]), indent=2))


if __name__ == "__main__":
    main()
