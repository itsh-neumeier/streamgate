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
    val dvrEnabled: Boolean,
    val streamProfiles: List<StreamQualityOption> = listOf(
        StreamQualityOption("hd", "HD"),
        StreamQualityOption("sd-480p", "SD")
    )
)

data class StreamQualityOption(
    val id: String,
    val label: String
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
    val mimeType: String,
    val quality: String,
    val qualityLabel: String
)
