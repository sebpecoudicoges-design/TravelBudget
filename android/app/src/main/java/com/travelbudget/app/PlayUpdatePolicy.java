package com.travelbudget.app;

import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

final class PlayUpdatePolicy {
    private static final String PLAY_APP_ID = "fr.pecloud.travelbudget";
    private static final String PLAY_STORE = "com.android.vending";
    private static final long DAY_MS = 24 * 60 * 60 * 1000L;

    private PlayUpdatePolicy() {}

    static boolean isPlayPackage(String appId) {
        return PLAY_APP_ID.equals(appId);
    }

    static boolean isPlayInstall(String appId, String installer) {
        return isPlayPackage(appId) && PLAY_STORE.equals(installer);
    }

    static boolean isSnoozed(int version, int snoozedVersion, long now, long snoozedAt) {
        long elapsed = now - snoozedAt;
        return snoozedVersion == version && elapsed >= 0 && elapsed < DAY_MS;
    }

    static boolean canOffer(int version, int availability, int status, boolean flexibleAllowed) {
        return version > 0 && availability == UpdateAvailability.UPDATE_AVAILABLE && flexibleAllowed
                && status != InstallStatus.PENDING && status != InstallStatus.DOWNLOADING
                && status != InstallStatus.DOWNLOADED && status != InstallStatus.INSTALLING;
    }
}
