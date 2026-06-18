package io.streamgate.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import io.streamgate.tv.viewmodel.StreamGateViewModel

@Composable
fun StreamGateApp(model: StreamGateViewModel) {
    val state by model.state.collectAsState()
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF101820)) {
            Box(modifier = Modifier.fillMaxSize().background(Color(0xFF101820))) {
                when {
                    state.loading -> LoadingScreen()
                    !state.activated -> ActivationScreen(error = state.error, onActivate = model::activate)
                    else -> HomeScreen(state = state, model = model)
                }
            }
        }
    }
}
