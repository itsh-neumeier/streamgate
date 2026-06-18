package io.streamgate.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.streamgate.tv.viewmodel.StreamGateUiState
import io.streamgate.tv.viewmodel.StreamGateViewModel

@Composable
fun LiveTvScreen(state: StreamGateUiState, model: StreamGateViewModel) {
    val selected = state.channels.getOrNull(state.selectedIndex)
    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        PlayerView(url = state.activeStream?.url)
        if (selected != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(40.dp)
                    .background(Color(0xCC101820))
                    .padding(20.dp)
            ) {
                Text("${selected.number}  ${selected.name}", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (state.showChannelList) ChannelListOverlay(state.channels, state.selectedIndex, model::selectChannel)
        if (state.showMiniGuide && selected != null) MiniGuideOverlay(selected)
        if (state.error != null) {
            Text(
                state.error,
                color = Color(0xFFFFC857),
                modifier = Modifier.align(Alignment.TopCenter).padding(24.dp)
            )
        }
    }
}
