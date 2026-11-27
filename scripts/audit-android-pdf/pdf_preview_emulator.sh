#!/usr/bin/env bash
# No interactive target other than the dedicated offline emulator.
set -euo pipefail
apk="${1:?audit APK required}"
dir="${2:?evidence directory required}"
pkg=org.travelbudget.audit.pdf
device() { "${ANDROID_HOME:?}/platform-tools/adb" -s emulator-5554 "$@"; }
test "$(device shell getprop ro.kernel.qemu | tr -d '\r')" = 1
test "$(device shell settings get global airplane_mode_on | tr -d '\r')" = 1
mkdir -p "$dir"
device install "$apk" | grep -Fx Success
trap 'device uninstall "$pkg" >/dev/null' EXIT
device shell am start -W -n "$pkg/com.travelbudget.app.MainActivity" | tee "$dir/launch.txt"
grep -F 'Status: ok' "$dir/launch.txt"
device shell dumpsys webviewupdate | grep 'Current WebView package' > "$dir/webview.txt"
dump_view() {
  device shell rm -f /sdcard/tb-pdf-audit.xml
  timeout 15 "${ANDROID_HOME}/platform-tools/adb" -s emulator-5554 shell uiautomator dump /sdcard/tb-pdf-audit.xml >/dev/null &&
    device exec-out cat /sdcard/tb-pdf-audit.xml > "$1"
}
coords=''
for attempt in $(seq 1 6); do
  if dump_view "$dir/before.xml"; then
    coords=$(python3 -B - "$dir/before.xml" "$pkg" <<'PY'
import re
import sys
from xml.etree import ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
pkg = sys.argv[2]
for view in root.iter('node'):
    if view.get('class') != 'android.webkit.WebView' or view.get('package') != pkg:
        continue
    for node in view.iter('node'):
        if node.get('package') != pkg or node.get('clickable') != 'true' or node.get('enabled') != 'true':
            continue
        if 'Open in new tab' not in {node.get('text'), node.get('content-desc')}:
            continue
        match = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if match:
            x0, y0, x1, y1 = map(int, match.groups())
            if x0 < x1 and y0 < y1:
                print((x0 + x1) // 2, (y0 + y1) // 2)
                sys.exit(0)
sys.exit(1)
PY
    ) && break
  fi
  sleep 1
done
[[ "$coords" =~ ^[0-9]+\ [0-9]+$ ]]
device exec-out screencap -p > "$dir/before.png"
read -r x y <<< "$coords"
device shell input tap "$x" "$y"
sleep 4
device exec-out screencap -p > "$dir/after.png"
dump_view "$dir/after.xml" || echo 'Accessibility tree unavailable after the tap' >&2
device shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' > "$dir/foreground.txt" || true
printf 'Captured a synthetic PDF iframe and tapped the real fallback link. Review the screenshots; an HTTP request or tap is not a rendering verdict.\n'
