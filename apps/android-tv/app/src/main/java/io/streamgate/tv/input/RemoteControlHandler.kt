package io.streamgate.tv.input

import android.view.KeyEvent

class RemoteControlHandler(
    private val onNextChannel: () -> Unit,
    private val onPreviousChannel: () -> Unit,
    private val onOk: () -> Unit,
    private val onBack: () -> Unit,
    private val onGuide: () -> Unit,
    private val onMenu: () -> Unit
) {
    fun handle(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN) return false
        return when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> true.also { onNextChannel() }
            KeyEvent.KEYCODE_DPAD_DOWN -> true.also { onPreviousChannel() }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> true.also { onOk() }
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT -> true.also { onGuide() }
            KeyEvent.KEYCODE_BACK -> true.also { onBack() }
            KeyEvent.KEYCODE_MENU -> true.also { onMenu() }
            else -> false
        }
    }
}
