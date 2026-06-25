package io.streamgate.tv.ui

import android.view.KeyEvent
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.nativeKeyEvent
import io.streamgate.tv.input.RemoteControlHandler
import io.streamgate.tv.viewmodel.StreamGateUiState
import io.streamgate.tv.viewmodel.StreamGateViewModel

@Composable
fun HomeScreen(state: StreamGateUiState, model: StreamGateViewModel) {
    val handler = remember(model) {
        RemoteControlHandler(
            onNextChannel = model::nextChannel,
            onPreviousChannel = model::previousChannel,
            onOk = model::toggleChannelList,
            onBack = model::closeOverlays,
            onGuide = model::toggleMiniGuide,
            onMenu = model::toggleQualityMenu
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .focusable()
            .onKeyEvent { handler.handle(KeyEvent(it.nativeKeyEvent.action, it.nativeKeyEvent.keyCode)) }
    ) {
        LiveTvScreen(state = state, model = model)
    }
}
