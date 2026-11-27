#!/usr/bin/env bash
# Strictly scoped to the disposable, offline CI emulator.
set -euo pipefail
apk="${1:?emulator APK required}"
variant="${2:?baseline or r8 required}"
case "$variant" in baseline|r8) ;; *) exit 2 ;; esac
round="${3:-1}"
case "$round" in 1|2|3) ;; *) exit 2 ;; esac
pkg=fr.pecloud.travelbudget
activity="$pkg/com.travelbudget.app.MainActivity"
device() { "${ANDROID_HOME:?}/platform-tools/adb" -s emulator-5554 "$@"; }
test "$(device shell getprop ro.kernel.qemu | tr -d '\r')" = 1
test "$(device shell settings get global airplane_mode_on | tr -d '\r')" = 1
device install "$apk" | grep -Fx Success
trap 'device uninstall "$pkg" >/dev/null' EXIT

dir="${RUNNER_TEMP:?}/tb-emulator-$variant-$round"
mkdir -p "$dir"
device shell dumpsys package "$pkg" > "$dir/package.txt"
grep -F 'versionName=10.5.397' "$dir/package.txt"
grep -F 'versionCode=10050397' "$dir/package.txt"
device shell cmd package resolve-activity --brief -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE -d "$pkg://auth-callback" -p "$pkg" > "$dir/oauth-route.txt"
grep -Fx "$activity" "$dir/oauth-route.txt"

dump_view() {
  timeout 12 "${ANDROID_HOME}/platform-tools/adb" -s emulator-5554 shell uiautomator dump /sdcard/tb-r8-window.xml >/dev/null &&
    device exec-out cat /sdcard/tb-r8-window.xml > "$dir/window.xml"
}
wait_auth_view() {
  local action="$1" attempt
  for attempt in $(seq 1 6); do
    if dump_view && python3 -B "$(dirname "$0")/auth_navigation.py" "$dir/window.xml" "$action"; then
      return 0
    fi
    sleep 1
  done
  echo "Offline auth navigation unavailable: $action [$variant]" >&2
  return 1
}
tap_auth_control() {
  local target x y
  target=$(wait_auth_view "$1")
  read -r x y <<< "$target"
  device shell input tap "$x" "$y"
}

device shell am start -W -n "$activity" | tee "$dir/launch.txt"
grep -F 'Status: ok' "$dir/launch.txt"
for retry in $(seq 1 20); do
  if dump_view &&
     python3 -B "$(dirname "$0")/check_offline_screen.py" "$dir/window.xml"; then
    pid=$(device shell pidof "$pkg" | tr -d '\r')
    [[ "$pid" =~ ^[1-9][0-9]*$ ]]
    sleep 3
    test "$(device shell pidof "$pkg" | tr -d '\r')" = "$pid"
    device shell dumpsys meminfo "$pid" > "$dir/meminfo.txt"
    mkdir -p "$RUNNER_TEMP/tb-startup-memory"
    python3 -B "$(dirname "$0")/startup_memory.py" sample "$dir/meminfo.txt" "$pid" \
      > "$RUNNER_TEMP/tb-startup-memory/$variant-$round.json"
    printf 'PASS [%s]: release login screen rendered locally in WebView and Android callback route resolves\n' "$variant"
    if [ "$round" = 1 ]; then
      tap_auth_control find-recovery
      wait_auth_view is-recovery
      tap_auth_control find-signin
      wait_auth_view is-signin
      test "$(device shell pidof "$pkg" | tr -d '\r')" = "$pid"
      printf 'PASS [%s]: login → recovery form → login offline, without submission\n' "$variant"
    fi
    exit 0
  fi
  sleep 2
done
echo "Offline WebView or its expected form did not render: $variant" >&2
exit 1
