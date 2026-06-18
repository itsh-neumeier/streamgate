package io.streamgate.tv.data

import android.content.Context

class TokenStorage(context: Context) {
    private val prefs = context.getSharedPreferences("streamgate", Context.MODE_PRIVATE)

    fun saveActivation(result: ActivationResult) {
        prefs.edit()
            .putString("deviceId", result.deviceId)
            .putString("deviceToken", result.deviceToken)
            .putString("customerId", result.customerId)
            .apply()
    }

    fun deviceId(): String? = prefs.getString("deviceId", null)

    fun deviceToken(): String? = prefs.getString("deviceToken", null)

    fun clear() {
        prefs.edit().clear().apply()
    }

    fun saveBootstrapCache(json: String) {
        prefs.edit().putString("bootstrapCache", json).apply()
    }

    fun bootstrapCache(): String? = prefs.getString("bootstrapCache", null)
}
