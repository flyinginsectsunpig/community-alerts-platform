package com.communityalerts.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    /** Never strand someone on the logo if a page load hangs. */
    private static final long MAX_SPLASH_MS = 30_000;

    private boolean pageReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The site can take many seconds to answer when its server is waking
        // up. The branded splash stays until it has, instead of a blank screen.
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        splash.setKeepOnScreenCondition(() -> !pageReady);
        new Handler(Looper.getMainLooper()).postDelayed(() -> pageReady = true, MAX_SPLASH_MS);

        getBridge()
            .addWebViewListener(
                new WebViewListener() {
                    @Override
                    public void onPageLoaded(WebView webView) {
                        pageReady = true;
                    }

                    @Override
                    public void onReceivedError(WebView webView) {
                        pageReady = true;
                    }
                }
            );

        // Back belongs to the page first: it closes whatever is open there,
        // and only leaves the app once there is nothing left to go back to.
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        WebView webView = getBridge().getWebView();
                        if (webView.canGoBack()) {
                            webView.goBack();
                            return;
                        }
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                }
            );
    }
}
