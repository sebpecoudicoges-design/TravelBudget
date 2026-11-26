"""Configure and compare the unsigned R8 experiment, never the distributed app."""

import argparse
import json
from pathlib import Path

from dex_inventory import inspect


def candidate_config(source: str) -> str:
    replacements = (
        ("            minifyEnabled false", "            minifyEnabled true"),
        ("getDefaultProguardFile('proguard-android.txt')",
         "getDefaultProguardFile('proguard-android-optimize.txt')"),
    )
    if any(source.count(old) != 1 or new in source for old, new in replacements):
        raise ValueError("Release Gradle source differs from the expected baseline")
    for old, new in replacements:
        source = source.replace(old, new, 1)
    return source


def compare(before: dict, after: dict) -> dict:
    original = before.get("bundle_metadata")
    optimized = after.get("bundle_metadata")
    if not original or not optimized or original["obfuscation_mapping"] or not optimized["obfuscation_mapping"]:
        raise ValueError("Expected an unmapped baseline and a mapped candidate AAB")
    if before["artifact_sha256"] == after["artifact_sha256"]:
        raise ValueError("Candidate and baseline must be different bundles")
    old_size, new_size = before["dex_uncompressed_bytes"], after["dex_uncompressed_bytes"]
    if new_size >= old_size:
        raise ValueError("The experimental candidate did not reduce DEX bytes")
    if before["native_uncompressed_bytes_by_abi"] != after["native_uncompressed_bytes_by_abi"]:
        raise ValueError("Native library size inventory changed in the DEX comparison")
    return {
        "baseline_dex_uncompressed_bytes": old_size,
        "candidate_dex_uncompressed_bytes": new_size,
        "dex_bytes_reduced": old_size - new_size,
        "dex_byte_reduction_pct": round(100 * (old_size - new_size) / old_size, 2),
        "candidate_mapping_present": True,
        "candidate_r8_json_present": optimized["r8_json"],
        "candidate_native_debug_symbols_present": optimized["native_debug_symbols"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    config = sub.add_parser("configure")
    config.add_argument("gradle_file", type=Path)
    metrics = sub.add_parser("compare")
    metrics.add_argument("baseline", type=Path)
    metrics.add_argument("candidate", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "configure":
            source = args.gradle_file.read_text(encoding="utf-8")
            args.gradle_file.write_text(candidate_config(source), encoding="utf-8")
        else:
            print(json.dumps(compare(inspect(args.baseline), inspect(args.candidate)), indent=2))
    except (ValueError, OSError) as error:
        parser.exit(2, f"R8 experiment unavailable: {error}\n")


if __name__ == "__main__":
    main()
