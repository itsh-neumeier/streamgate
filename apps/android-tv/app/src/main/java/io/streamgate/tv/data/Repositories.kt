package io.streamgate.tv.data

class ChannelRepository(private val apiClient: ApiClient) {
    fun list(): List<Channel> = apiClient.channels()
}

class StreamRepository(private val apiClient: ApiClient) {
    fun open(channelId: String, quality: String): StreamOpenResult = apiClient.openStream(channelId, quality)
}

class EpgRepository {
    fun nowNext(channel: Channel): Pair<String, String> = "${channel.name} Live" to "${channel.name} Magazin"
}

class DvrRepository {
    fun recordings(): List<String> = emptyList()
}
