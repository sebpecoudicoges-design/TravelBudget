"""Extract comparable main-process memory snapshots from an offline emulator."""
import argparse
import json
from pathlib import Path
import re
import statistics


PACKAGE = "fr.pecloud.travelbudget"
VARIANTS = ("baseline", "r8")
REPEATS = 3


def read_snapshot(content: str, pid: int) -> dict:
    headers = re.findall(r"^\*\* MEMINFO in pid (\d+) \[([^\]]+)\] \*\*\s*$", content, re.M)
    if headers != [(str(pid), PACKAGE)]:
        raise ValueError("meminfo does not identify the expected main process")
    totals = re.findall(r"^[ \t]*TOTAL PSS:\s+(\d+)[ \t]+TOTAL RSS:\s+(\d+)\b", content, re.M)
    if len(totals) != 1 or not all(int(value) > 0 for value in totals[0]):
        raise ValueError("Missing or ambiguous main-process PSS/RSS")
    pss, rss = map(int, totals[0])
    return {"total_pss_kib": pss, "total_rss_kib": rss}


def summarize(directory: Path) -> dict:
    result = {}
    for variant in VARIANTS:
        files = sorted(directory.glob(f"{variant}-[1-3].json"))
        if len(files) != REPEATS:
            raise ValueError(f"{variant}: three snapshots required")
        samples = [json.loads(p.read_text()) for p in files]
        if any(s.keys() != {"total_pss_kib", "total_rss_kib"} for s in samples):
            raise ValueError("Unexpected memory snapshot")
        result[variant] = {
            "samples": samples,
            "median_total_pss_kib": statistics.median(s["total_pss_kib"] for s in samples),
            "median_total_rss_kib": statistics.median(s["total_rss_kib"] for s in samples),
        }
    return {"scope": "main process, offline fresh login; not Android vitals", "variants": result}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    sample = commands.add_parser("sample")
    sample.add_argument("snapshot", type=Path)
    sample.add_argument("pid", type=int)
    summary = commands.add_parser("summary")
    summary.add_argument("directory", type=Path)
    args = parser.parse_args()
    try:
        result = read_snapshot(args.snapshot.read_text(), args.pid) if args.command == "sample" else summarize(args.directory)
    except (OSError, ValueError) as error:
        parser.exit(2, f"Cannot report emulator memory: {error}\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
