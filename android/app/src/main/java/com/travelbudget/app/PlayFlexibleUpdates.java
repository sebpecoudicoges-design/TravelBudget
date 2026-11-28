package com.travelbudget.app;

import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;

final class PlayFlexibleUpdates {
    private static final String TAG = "TravelBudgetUpdate";
    private static final long STARTUP_DELAY_MS = 6000;
    private static final String OFFER = "offer";
    private static final String RESTART = "restart";

    private final AppCompatActivity activity;
    private final AppUpdateManager manager;
    private final SharedPreferences preferences;
    private final ActivityResultLauncher<IntentSenderRequest> launcher;
    private final InstallStateUpdatedListener listener;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable check = () -> requestState(false);
    private final AppUpdateOptions options = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build();

    private boolean foreground;
    private boolean firstResume = true;
    private boolean promptInFlight;
    private boolean completionInFlight;
    private int revision;
    private Snackbar notice;
    private int noticeVersion;
    private boolean noticeIsReady;

    static boolean isPlayInstall(AppCompatActivity activity) {
        String appId = activity.getPackageName();
        if (!PlayUpdatePolicy.isPlayPackage(appId)) return false; // Direct/debug APK has a different appId.
        try {
            PackageManager packages = activity.getPackageManager();
            String installer = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? packages.getInstallSourceInfo(appId).getInstallingPackageName()
                    : packages.getInstallerPackageName(appId);
            return PlayUpdatePolicy.isPlayInstall(appId, installer);
        } catch (PackageManager.NameNotFoundException | RuntimeException error) {
            return false; // The app still starts if installer metadata is unavailable.
        }
    }

    PlayFlexibleUpdates(AppCompatActivity activity) {
        this.activity = activity;
        manager = AppUpdateManagerFactory.create(activity.getApplicationContext());
        preferences = activity.getSharedPreferences("travelbudget_play_updates", 0);
        launcher = activity.registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                result -> {
                    promptInFlight = false;
                    if (foreground) requestState(false);
                }
        );
        listener = state -> {
            if (state.installStatus() == InstallStatus.DOWNLOADED) main.post(check);
        };
    }

    void resume() {
        if (foreground) return;
        foreground = true;
        manager.registerListener(listener);
        // Wait for the initial native launch overlay; later checks follow the Activity lifecycle.
        main.postDelayed(check, firstResume ? STARTUP_DELAY_MS : 0);
        firstResume = false;
    }

    void pause() {
        if (!foreground) return;
        foreground = false;
        revision++;
        main.removeCallbacks(check);
        manager.unregisterListener(listener);
        dismissNotice();
    }

    private boolean isVisible() {
        return foreground && !activity.isFinishing() && !activity.isDestroyed();
    }

    private void requestState(boolean downloadRequested) {
        if (!isVisible() || completionInFlight) return;
        int current = ++revision;
        manager.getAppUpdateInfo()
                .addOnSuccessListener(activity, info -> {
                    if (current == revision && isVisible() && !completionInFlight) applyState(info, downloadRequested);
                })
                .addOnFailureListener(activity, error -> Log.d(TAG, "No Play update state", error));
    }

    private void applyState(AppUpdateInfo info, boolean downloadRequested) {
        int status = info.installStatus();
        int version = info.availableVersionCode();
        if (status == InstallStatus.DOWNLOADED) {
            if (!promptInFlight && !isSnoozed(RESTART, version)) showNotice(version, true);
            return;
        }

        if (promptInFlight || isSnoozed(OFFER, version)
                || !PlayUpdatePolicy.canOffer(version, info.updateAvailability(), status, info.isUpdateTypeAllowed(options))) {
            dismissNotice();
            return;
        }
        if (!downloadRequested) {
            showNotice(version, false);
            return;
        }

        // An explicit tap leads to Google's consent; never show its dialog at startup.
        dismissNotice();
        snooze(OFFER, version);
        try {
            promptInFlight = manager.startUpdateFlowForResult(info, launcher, options);
        } catch (RuntimeException error) {
            promptInFlight = false;
            Log.w(TAG, "Play update prompt unavailable", error);
        }
    }

    private void showNotice(int version, boolean ready) {
        if (notice != null && noticeVersion == version && noticeIsReady == ready) return;
        dismissNotice();
        View content = activity.findViewById(com.getcapacitor.android.R.id.webview);
        if (content == null) return;
        Snackbar bar = Snackbar.make(content, ready ? R.string.play_update_ready : R.string.play_update_available,
                Snackbar.LENGTH_INDEFINITE)
                .setAction(ready ? R.string.play_update_restart : R.string.play_update_download, view -> {
                    if (!isVisible()) return;
                    if (ready) complete(version);
                    else requestState(true); // Get a fresh AppUpdateInfo for the only allowed attempt.
                });
        // Keep the existing web navigation control usable beneath the banner.
        ViewGroup.LayoutParams layout = bar.getView().getLayoutParams();
        if (layout instanceof ViewGroup.MarginLayoutParams) {
            ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) layout;
            margins.bottomMargin += Math.round(68 * activity.getResources().getDisplayMetrics().density);
            bar.getView().setLayoutParams(margins);
        }
        bar.addCallback(new Snackbar.Callback() {
            @Override public void onDismissed(Snackbar removed, int event) {
                if (notice == removed) notice = null;
                if (event == DISMISS_EVENT_SWIPE) snooze(ready ? RESTART : OFFER, version);
            }
        });
        notice = bar;
        noticeVersion = version;
        noticeIsReady = ready;
        bar.show();
    }

    private void dismissNotice() {
        Snackbar old = notice;
        notice = null;
        if (old != null) old.dismiss();
    }

    private void complete(int version) {
        if (!isVisible() || completionInFlight) return;
        completionInFlight = true;
        manager.completeUpdate().addOnFailureListener(error -> {
            completionInFlight = false;
            snooze(RESTART, version);
            if (isVisible()) {
                Toast.makeText(activity, R.string.play_update_restart_failed, Toast.LENGTH_LONG).show();
            }
            Log.w(TAG, "Play update completion failed", error);
        });
    }

    private boolean isSnoozed(String key, int version) {
        return PlayUpdatePolicy.isSnoozed(version, preferences.getInt(key + "_version", -1),
                System.currentTimeMillis(), preferences.getLong(key + "_time", 0));
    }

    private void snooze(String key, int version) {
        preferences.edit().putInt(key + "_version", version)
                .putLong(key + "_time", System.currentTimeMillis()).apply();
    }
}
