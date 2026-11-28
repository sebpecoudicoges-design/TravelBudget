package com.travelbudget.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PlayFlexibleUpdates playUpdates;

    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TravelBudgetAdsPlugin.class);
        super.onCreate(savedInstanceState);
        if (PlayFlexibleUpdates.isPlayInstall(this)) {
            playUpdates = new PlayFlexibleUpdates(this);
        }
    }

    @Override public void onResume() {
        super.onResume();
        if (playUpdates != null) playUpdates.resume();
    }

    @Override public void onPause() {
        if (playUpdates != null) playUpdates.pause();
        super.onPause();
    }
}
