package com.travelbudget.app;

import android.content.pm.ApplicationInfo;
import android.view.ViewGroup;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keep the entire WebView, including fixed controls and dialogs, above the native banner. */
@CapacitorPlugin(name = "TravelBudgetAds")
public class TravelBudgetAdsPlugin extends Plugin {
    private Integer initialBottomMargin;

    @PluginMethod public void configuration(PluginCall call) {
        JSObject result = new JSObject();
        result.put("testing", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        call.resolve(result);
    }

    @PluginMethod public void inset(PluginCall call) {
        double height = call.getDouble("height", 0.0);
        if (!Double.isFinite(height) || height < 0 || height > 300) {
            call.reject("Invalid banner height");
            return;
        }
        getActivity().runOnUiThread(() -> {
            ViewGroup.LayoutParams raw = getBridge().getWebView().getLayoutParams();
            if (!(raw instanceof ViewGroup.MarginLayoutParams)) {
                call.reject("Unsupported WebView layout");
                return;
            }
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) raw;
            if (initialBottomMargin == null) initialBottomMargin = params.bottomMargin;
            params.bottomMargin = initialBottomMargin + (int) Math.ceil(height * getContext().getResources().getDisplayMetrics().density);
            getBridge().getWebView().setLayoutParams(params);
            call.resolve();
        });
    }
}
