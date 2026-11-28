package com.travelbudget.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;
import org.junit.Test;

public class PlayUpdatePolicyTest {
    @Test public void onlyPlayPackageInstalledByPlayIsEligible() {
        assertTrue(PlayUpdatePolicy.isPlayInstall("fr.pecloud.travelbudget", "com.android.vending"));
        assertFalse(PlayUpdatePolicy.isPlayInstall("com.travelbudget.app", "com.android.vending"));
        assertFalse(PlayUpdatePolicy.isPlayInstall("fr.pecloud.travelbudget", null));
        assertFalse(PlayUpdatePolicy.isPlayInstall("fr.pecloud.travelbudget", "com.android.shell"));
    }

    @Test public void onlyFlexibleAvailableUpdatesNotAlreadyInProgressAreOffered() {
        int available = UpdateAvailability.UPDATE_AVAILABLE;
        assertTrue(PlayUpdatePolicy.canOffer(42, available, InstallStatus.UNKNOWN, true));
        assertFalse(PlayUpdatePolicy.canOffer(0, available, InstallStatus.UNKNOWN, true));
        assertFalse(PlayUpdatePolicy.canOffer(42, available, InstallStatus.UNKNOWN, false));
        assertFalse(PlayUpdatePolicy.canOffer(42, UpdateAvailability.UPDATE_NOT_AVAILABLE, InstallStatus.UNKNOWN, true));
        for (int status : new int[] { InstallStatus.PENDING, InstallStatus.DOWNLOADING, InstallStatus.DOWNLOADED, InstallStatus.INSTALLING }) {
            assertFalse(PlayUpdatePolicy.canOffer(42, available, status, true));
        }
    }

    @Test public void postponeAppliesToTheSameVersionForADay() {
        long day = 86_400_000L;
        assertTrue(PlayUpdatePolicy.isSnoozed(42, 42, day + 9, 10));
        assertFalse(PlayUpdatePolicy.isSnoozed(42, 42, day + 10, 10));
        assertFalse(PlayUpdatePolicy.isSnoozed(43, 42, day + 9, 10));
        assertFalse(PlayUpdatePolicy.isSnoozed(42, 42, 9, 10));
    }
}
