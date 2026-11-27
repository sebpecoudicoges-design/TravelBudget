"""Validate the release login view, not just a surviving Android process."""
import argparse
import xml.etree.ElementTree as ET


PACKAGE = "fr.pecloud.travelbudget"


def login_screen_present(root: ET.Element) -> bool:
    for node in root.iter("node"):
        if node.get("package") != PACKAGE or node.get("class") != "android.webkit.WebView":
            continue
        items = [item for item in node.iter("node") if item.get("package") == PACKAGE]
        if any(item.get("class") == "android.widget.EditText" for item in items) and any(
            (item.get("text") or item.get("content-desc") or "").strip().casefold()
            in {"se connecter", "sign in", "connexion"}
            for item in items
        ):
            return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("window_xml")
    args = parser.parse_args()
    try:
        found = login_screen_present(ET.parse(args.window_xml).getroot())
    except (OSError, ET.ParseError):
        found = False
    if not found:
        parser.exit(1)


if __name__ == "__main__":
    main()
