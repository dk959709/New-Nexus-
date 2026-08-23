package com.nexus.intelligence;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NetworkScannerPlugin.class);
        registerPlugin(AndroidTvRemotePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
