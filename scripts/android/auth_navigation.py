"""Read the accessibility tree for offline auth navigation; never submit forms."""
import argparse
import re
import unicodedata
import xml.etree.ElementTree as ET

from check_offline_screen import PACKAGE, login_screen_present


def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFD", text.casefold())
                   if unicodedata.category(c) != "Mn").strip()


def web_items(root):
    for view in root.iter("node"):
        if view.get("class") == "android.webkit.WebView" and view.get("package") == PACKAGE:
            yield from (item for item in view.iter("node") if item.get("package") == PACKAGE)


def label(item):
    return normalized(item.get("text") or item.get("content-desc") or "")


def recovery_screen(root):
    items = list(web_items(root))
    return any(label(item) in {"envoyer le lien", "send reset link"} for item in items) and not any(
        item.get("password") == "true" for item in items
    )


def control(root, mode):
    expected = {
        "recovery": ("mot de passe oublie", "forgot password", "mot de passe", "password"),
        "signin": ("retour connexion", "back to sign in", "connexion", "sign in"),
    }[mode]
    items = list(web_items(root))
    for title in expected:
        for item in items:
            if label(item) != title or item.get("clickable") != "true" or item.get("enabled") != "true":
                continue
            if item.get("class") not in {"android.widget.Button", "android.widget.ToggleButton"}:
                continue
            m = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", item.get("bounds", ""))
            if m:
                left, top, right, bottom = map(int, m.groups())
                if left < right and top < bottom:
                    return (left + right) // 2, (top + bottom) // 2
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xml")
    parser.add_argument("action", choices=("find-recovery", "find-signin", "is-recovery", "is-signin"))
    args = parser.parse_args()
    try:
        root = ET.parse(args.xml).getroot()
    except (ET.ParseError, OSError):
        parser.exit(1)
    if args.action.startswith("find-"):
        coords = control(root, args.action[5:])
        if coords:
            print(*coords)
            return
    elif args.action == "is-recovery" and recovery_screen(root):
        return
    elif args.action == "is-signin" and login_screen_present(root) and not recovery_screen(root):
        return
    parser.exit(1)


if __name__ == "__main__":
    main()
