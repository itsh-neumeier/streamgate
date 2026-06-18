package io.streamgate.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import io.streamgate.tv.data.ApiClient
import io.streamgate.tv.data.TokenStorage
import io.streamgate.tv.ui.StreamGateApp
import io.streamgate.tv.viewmodel.StreamGateViewModel
import io.streamgate.tv.viewmodel.StreamGateViewModelFactory

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val tokenStorage = TokenStorage(applicationContext)
        val apiClient = ApiClient(BuildConfig.API_BASE_URL, tokenStorage)
        setContent {
            val model: StreamGateViewModel = viewModel(factory = StreamGateViewModelFactory(apiClient, tokenStorage))
            StreamGateApp(model)
        }
    }
}
