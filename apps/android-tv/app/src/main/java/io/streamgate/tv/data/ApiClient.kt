package io.streamgate.tv.data

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(
    private val baseUrl: String,
    private val tokenStorage: TokenStorage
) {
    fun activate(code: String, deviceName: String): ActivationResult {
        val json = postJson(
            "/api/device/activate",
            JSONObject()
                .put("activationCode", code)
                .put("deviceName", deviceName)
                .put("deviceType", "android_tv")
                .put("appVersion", "0.1.0")
        )
        return ActivationResult(json.getString("deviceId"), json.getString("deviceToken"), json.getString("customerId"))
    }

    fun bootstrap(): BootstrapConfig {
        val raw = getRaw("/api/app/bootstrap")
        tokenStorage.saveBootstrapCache(raw)
        return parseBootstrap(JSONObject(raw))
    }

    fun cachedBootstrap(): BootstrapConfig? {
        val raw = tokenStorage.bootstrapCache() ?: return null
        return runCatching { parseBootstrap(JSONObject(raw)) }.getOrNull()
    }

    fun channels(): List<Channel> {
        val json = getJson("/api/channels")
        val array = json.getJSONArray("channels")
        return parseChannels(array)
    }

    fun openStream(channelId: String, quality: String): StreamOpenResult {
        val deviceId = tokenStorage.deviceId() ?: error("Device is not activated")
        val json = postJson(
            "/api/stream/open",
            JSONObject()
                .put("channelId", channelId)
                .put("deviceId", deviceId)
                .put("quality", quality)
        )
        return StreamOpenResult(
            json.getString("streamSessionId"),
            json.getString("url"),
            json.optInt("expiresIn", 60),
            json.optString("mimeType", "application/x-mpegURL"),
            json.optString("quality", quality),
            json.optString("qualityLabel", if (quality == "sd-480p") "SD" else "HD")
        )
    }

    fun heartbeat(channelId: String?, screen: String, playerState: String) {
        val deviceId = tokenStorage.deviceId() ?: return
        postJson(
            "/api/device/heartbeat",
            JSONObject()
                .put("deviceId", deviceId)
                .put("appVersion", "0.1.0")
                .put("currentScreen", screen)
                .put("currentChannel", channelId)
                .put("playerState", playerState)
                .put("network", JSONObject().put("type", "wifi").put("quality", "good"))
        )
    }

    private fun parseBootstrap(json: JSONObject): BootstrapConfig {
        val ui = json.getJSONObject("ui")
        val branding = json.getJSONObject("branding")
        val features = json.getJSONObject("features")
        val profiles = json.optJSONArray("streamProfiles")
        return BootstrapConfig(
            appName = branding.optString("appName", "StreamGate TV"),
            startScreen = ui.optString("startScreen", "live_tv"),
            startChannel = ui.optString("startChannel", "ard-hd"),
            primaryColor = branding.optString("primaryColor", "#0066cc"),
            dvrEnabled = features.optBoolean("dvr", false),
            streamProfiles = if (profiles != null) {
                (0 until profiles.length()).map { index ->
                    val item = profiles.getJSONObject(index)
                    StreamQualityOption(item.optString("id", "hd"), item.optString("label", "HD"))
                }
            } else {
                listOf(StreamQualityOption("hd", "HD"), StreamQualityOption("sd-480p", "SD"))
            }
        )
    }

    private fun parseChannels(array: JSONArray): List<Channel> {
        return (0 until array.length()).map { index ->
            val item = array.getJSONObject(index)
            Channel(
                id = item.getString("id"),
                number = item.optInt("number"),
                name = item.getString("name"),
                logo = item.optString("logoUrl", item.optString("logo", "")),
                group = item.optString("group"),
                favorite = item.optBoolean("favorite", false),
                streamProfile = item.optString("streamProfile", "hls-lan")
            )
        }
    }

    private fun getJson(path: String): JSONObject = JSONObject(getRaw(path))

    private fun getRaw(path: String): String = request("GET", path, null)

    private fun postJson(path: String, body: JSONObject): JSONObject = JSONObject(request("POST", path, body.toString()))

    private fun request(method: String, path: String, body: String?): String {
        val connection = URL("$baseUrl$path").openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 5000
        connection.readTimeout = 8000
        tokenStorage.deviceToken()?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) {
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.outputStream.use { it.write(body.toByteArray()) }
        }
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val text = BufferedReader(InputStreamReader(stream)).use { it.readText() }
        if (connection.responseCode !in 200..299) error(text)
        return text
    }
}
