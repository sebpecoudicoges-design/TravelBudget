"""Inventory package bytes without guessing Google Play optimization scores."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile


def inspect(path: Path) -> dict:
    suffix = path.suffix.lower()
    if suffix not in {".aab", ".apk"}:
        raise ValueError("Expected an .aab or .apk archive")
    bundle = suffix == ".aab"
    dex_pattern = re.compile(r"(?:[^/]+/dex/)classes(?:[0-9]+)?\.dex" if bundle else r"classes(?:[0-9]+)?\.dex")
    native_pattern = re.compile(r"(?:[^/]+/)?lib/([^/]+)/[^/]+\.so" if bundle else r"lib/([^/]+)/[^/]+\.so")
    with path.open("rb") as stream:
        sha256 = hashlib.file_digest(stream, "sha256").hexdigest()
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        names = {entry.filename for entry in entries}
        if len(names) != len(entries):
            raise ValueError("Ambiguous archive: duplicate entries")
        manifest = "base/manifest/AndroidManifest.xml" if bundle else "AndroidManifest.xml"
        if manifest not in names or (bundle and "BundleConfig.pb" not in names):
            raise ValueError("Package manifest or bundle configuration missing")
        dex = []
        abis: dict[str, int] = {}
        for entry in entries:
            name = entry.filename
            if dex_pattern.fullmatch(name):
                dex.append({"entry": name, "uncompressed_bytes": entry.file_size})
            if match := native_pattern.fullmatch(name):
                abi = match.group(1)
                abis[abi] = abis.get(abi, 0) + entry.file_size
        if not dex or any(row["uncompressed_bytes"] == 0 for row in dex):
            raise ValueError("No usable DEX entries")
    metadata = "BUNDLE-METADATA/com.android.tools.build."
    return {
        "artifact": path.name,
        "artifact_type": suffix[1:],
        "artifact_sha256": sha256,
        "dex_uncompressed_bytes": sum(row["uncompressed_bytes"] for row in dex),
        "dex": sorted(dex, key=lambda row: row["entry"]),
        "native_uncompressed_bytes_by_abi": dict(sorted(abis.items())),
        "bundle_metadata": {
            "r8_json": any(n.startswith("BUNDLE-METADATA/") and n.endswith("/r8.json") for n in names),
            "obfuscation_mapping": metadata + "obfuscation/proguard.map" in names,
            "native_debug_symbols": any(n.startswith(metadata + "debugsymbols/") and not n.endswith("/") for n in names),
        } if bundle else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path)
    args = parser.parse_args()
    try:
        result = inspect(args.artifact)
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        parser.exit(2, f"DEX inventory unavailable: {error}\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
