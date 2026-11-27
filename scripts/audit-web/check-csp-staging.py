"""Check the F12 staging boundary in the versioned config and built HTML."""
import argparse
import tomllib
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def parse_directives(value):
    result = {}
    for directive in value.split(";"):
        words = directive.split()
        if words:
            name = words[0].lower()
            require(name not in result, f"Duplicate directive: {name}")
            result[name] = set(words[1:])
    return result


class ConsentMarkup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.resources = {"script": set(), "style": set()}

    def handle_starttag(self, tag, attrs):
        attrib = dict(attrs)
        require(not any(name.startswith("on") or name == "style" for name in attrib),
                "Consent page has inline event or style attributes")
        require(tag not in {"base", "form", "style"}, f"Unexpected consent tag: {tag}")
        if tag == "script":
            self.local_resource("script", attrib.get("src"))
        if tag == "link" and "stylesheet" in (attrib.get("rel") or "").lower().split():
            self.local_resource("style", attrib.get("href"))

    def local_resource(self, kind, url):
        parsed = urlsplit(url or "")
        require(not parsed.scheme and not parsed.netloc and parsed.path.startswith("/")
                and not parsed.path.startswith("//") and not parsed.query and not parsed.fragment
                and ".." not in parsed.path.split("/"), f"Non-local consent {kind}: {url!r}")
        self.resources[kind].add(parsed.path.lstrip("/"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, help="Also verify the output of npm run build")
    args = parser.parse_args()
    with (ROOT / "netlify.toml").open("rb") as file:
        config = tomllib.load(file)
    rules = {}
    for block in config["headers"]:
        route = block["for"]
        require(route not in rules, f"Duplicate header scope: {route}")
        rules[route] = {key.lower(): value for key, value in block["values"].items()}
    consent_path = "/connect-chatgpt.html"
    enforced = "content-security-policy"
    report_only = enforced + "-report-only"
    require({route for route, values in rules.items() if enforced in values} == {consent_path},
            "Blocking CSP boundary changed: revalidate F12 before updating this contract")
    require(report_only in rules.get("/*", {}), "Missing general report-only policy")
    consent = rules[consent_path]
    strict = parse_directives(consent[enforced])
    expected = {
        "default-src": {"'self'"}, "script-src": {"'self'"}, "style-src": {"'self'"},
        "connect-src": {"'self'", "https://obznbrzarhvmlbprcfie.supabase.co"},
        "base-uri": {"'none'"}, "frame-ancestors": {"'none'"}, "form-action": {"'none'"},
    }
    for name, values in expected.items():
        require(strict.get(name) == values, f"Consent directive changed: {name}")
    require(consent.get("cache-control") == "no-store"
            and consent.get("referrer-policy") == "no-referrer",
            "Consent header contract changed")
    require(not (ROOT / "public" / "_headers").exists(), "Review the additional public/_headers")
    source = ConsentMarkup()
    source.feed((ROOT / "public" / consent_path[1:]).read_text(encoding="utf-8"))
    require(all(source.resources.values()), "Consent page lost a script or stylesheet")
    if args.dist:
        require(not (args.dist / "_headers").exists(), "Review the additional built _headers")
        built = ConsentMarkup()
        built.feed((args.dist / consent_path[1:]).read_text(encoding="utf-8"))
        require(built.resources == source.resources, "Built consent resources differ from source")
        for paths in built.resources.values():
            for path in paths:
                require((args.dist / path).is_file(), f"Missing built consent resource: {path}")
    print("F12: Report-Only global scope, enforced consent headers and local consent assets verified.")


if __name__ == "__main__":
    main()
