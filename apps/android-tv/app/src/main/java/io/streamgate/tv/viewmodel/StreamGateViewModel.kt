package io.streamgate.tv.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import io.streamgate.tv.data.ApiClient
import io.streamgate.tv.data.BootstrapConfig
import io.streamgate.tv.data.Channel
import io.streamgate.tv.data.StreamOpenResult
import io.streamgate.tv.data.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class StreamGateUiState(
    val activated: Boolean = false,
    val loading: Boolean = true,
    val error: String? = null,
    val bootstrap: BootstrapConfig? = null,
    val channels: List<Channel> = emptyList(),
    val selectedIndex: Int = 0,
    val activeStream: StreamOpenResult? = null,
    val showChannelList: Boolean = false,
    val showMiniGuide: Boolean = false
)

class StreamGateViewModel(
    private val apiClient: ApiClient,
    private val tokenStorage: TokenStorage
) : ViewModel() {
    private val _state = MutableStateFlow(StreamGateUiState())
    val state: StateFlow<StreamGateUiState> = _state.asStateFlow()
    private var zapJob: Job? = null

    init {
        start()
    }

    fun start() {
        viewModelScope.launch(Dispatchers.IO) {
            val activated = tokenStorage.deviceToken() != null
            if (!activated) {
                _state.value = StreamGateUiState(activated = false, loading = false)
                return@launch
            }
            runCatching {
                val bootstrap = apiClient.bootstrap()
                val channels = apiClient.channels()
                val startIndex = channels.indexOfFirst { it.id == bootstrap.startChannel }.coerceAtLeast(0)
                _state.value = StreamGateUiState(activated = true, loading = false, bootstrap = bootstrap, channels = channels, selectedIndex = startIndex)
                openSelectedStream()
            }.onFailure {
                val cached = apiClient.cachedBootstrap()
                _state.value = StreamGateUiState(activated = true, loading = false, error = "StreamGate ist gerade nicht erreichbar.", bootstrap = cached)
            }
        }
    }

    fun activate(code: String) {
        viewModelScope.launch(Dispatchers.IO) {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching {
                val result = apiClient.activate(code, "Android TV Stick")
                tokenStorage.saveActivation(result)
                start()
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = "Aktivierung fehlgeschlagen.")
            }
        }
    }

    fun nextChannel() = moveSelection(1)

    fun previousChannel() = moveSelection(-1)

    fun toggleChannelList() {
        _state.value = _state.value.copy(showChannelList = !_state.value.showChannelList, showMiniGuide = false)
    }

    fun toggleMiniGuide() {
        _state.value = _state.value.copy(showMiniGuide = !_state.value.showMiniGuide, showChannelList = false)
    }

    fun closeOverlays() {
        _state.value = _state.value.copy(showChannelList = false, showMiniGuide = false)
    }

    fun selectChannel(index: Int) {
        _state.value = _state.value.copy(selectedIndex = index, showChannelList = false)
        scheduleZap()
    }

    private fun moveSelection(delta: Int) {
        val current = _state.value
        if (current.channels.isEmpty()) return
        val next = (current.selectedIndex + delta + current.channels.size) % current.channels.size
        _state.value = current.copy(selectedIndex = next)
        scheduleZap()
    }

    private fun scheduleZap() {
        zapJob?.cancel()
        zapJob = viewModelScope.launch(Dispatchers.IO) {
            delay(300)
            openSelectedStream()
        }
    }

    private fun openSelectedStream() {
        val current = _state.value
        val channel = current.channels.getOrNull(current.selectedIndex) ?: return
        runCatching {
            val stream = apiClient.openStream(channel.id)
            apiClient.heartbeat(channel.id, "live_tv", "playing")
            _state.value = _state.value.copy(activeStream = stream, error = null)
        }.onFailure {
            _state.value = _state.value.copy(error = "Stream konnte nicht gestartet werden.")
        }
    }
}

class StreamGateViewModelFactory(
    private val apiClient: ApiClient,
    private val tokenStorage: TokenStorage
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        @Suppress("UNCHECKED_CAST")
        return StreamGateViewModel(apiClient, tokenStorage) as T
    }
}
