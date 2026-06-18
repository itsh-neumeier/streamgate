package io.streamgate.tv.data

data class Channel(
    val id: String,
    val number: Int,
    val name: String,
    val logo: String?,
    val group: String?,
    val favorite: Boolean,
    val streamProfile: String
)

data class BootstrapConfig(
    val appName: String,
    val startScreen: String,
    val startChannel: String,
    val primaryColor: String,
    val dvrEnabled: Boolean
)

data class ActivationResult(
    val deviceId: String,
    val deviceToken: String,
    val customerId: String
)

data class StreamOpenResult(
    val streamSessionId: String,
    val url: String,
    val expiresIn: Int,
    val mimeType: String
)
