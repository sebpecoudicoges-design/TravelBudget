import unittest
import xml.etree.ElementTree as ET

from check_offline_screen import PACKAGE, login_screen_present


def view(package=PACKAGE, webview=True, fields=True, label="Se connecter"):
    cls = "android.webkit.WebView" if webview else "android.widget.FrameLayout"
    root = ET.Element("hierarchy")
    parent = ET.SubElement(root, "node", {"package": package, "class": cls})
    if fields:
        ET.SubElement(parent, "node", {"package": package, "class": "android.widget.EditText"})
    ET.SubElement(parent, "node", {"package": package, "class": "android.widget.Button", "text": label})
    return root


class OfflineScreenTest(unittest.TestCase):
    def test_login_is_recognized_in_both_languages(self):
        self.assertTrue(login_screen_present(view()))
        self.assertTrue(login_screen_present(view(label="Sign in")))

    def test_wrong_app_and_native_surfaces_do_not_count(self):
        self.assertFalse(login_screen_present(view(package="example.other")))
        self.assertFalse(login_screen_present(view(webview=False)))

    def test_blank_webview_or_misleading_label_does_not_count(self):
        self.assertFalse(login_screen_present(view(fields=False)))
        self.assertFalse(login_screen_present(view(label="Erreur de connexion")))
