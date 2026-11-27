import unittest
import xml.etree.ElementTree as ET

from auth_navigation import control, recovery_screen
from check_offline_screen import PACKAGE


def screen():
    root = ET.Element("hierarchy")
    return root, ET.SubElement(root, "node", {"class": "android.webkit.WebView", "package": PACKAGE})


def item(parent, text, cls="android.widget.Button", **options):
    ET.SubElement(parent, "node", {
        "class": cls, "package": PACKAGE, "text": text, "bounds": "[10,20][90,60]",
        "clickable": "true", "enabled": "true", **options,
    })


class AuthNavigationTest(unittest.TestCase):
    def test_uses_visible_legitimate_control_not_password_edit_field(self):
        root, view = screen()
        item(view, "Mot de passe", "android.widget.EditText")
        item(view, "Mot de passe oublié", bounds="[0,0][0,0]")
        self.assertIsNone(control(root, "recovery"))
        item(view, "Mot de passe", bounds="[12,60][84,100]")
        self.assertEqual(control(root, "recovery"), (48, 80))

    def test_checks_recovery_and_back_without_submitting(self):
        root, view = screen()
        item(view, "Send reset link")
        self.assertIsNone(control(root, "recovery"))
        item(view, "Back to sign in")
        self.assertEqual(control(root, "signin"), (50, 40))
        self.assertTrue(recovery_screen(root))
        item(view, "", "android.widget.EditText", password="true")
        self.assertFalse(recovery_screen(root))
