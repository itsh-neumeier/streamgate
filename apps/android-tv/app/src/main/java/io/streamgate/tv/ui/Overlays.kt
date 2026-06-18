package io.streamgate.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.streamgate.tv.data.Channel

@Composable
fun ChannelListOverlay(channels: List<Channel>, selectedIndex: Int, onSelect: (Int) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(420.dp)
            .background(Color(0xEE172026))
            .padding(18.dp)
    ) {
        Text("Sender", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        channels.forEachIndexed { index, channel ->
            val selected = index == selectedIndex
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .border(2.dp, if (selected) Color(0xFFFFC857) else Color.Transparent)
                    .background(if (selected) Color(0x553A7CA5) else Color.Transparent)
                    .clickable { onSelect(index) }
                    .padding(12.dp)
            ) {
                Text(channel.number.toString(), color = Color.White, modifier = Modifier.width(48.dp))
                Text(channel.name, color = Color.White)
            }
        }
    }
}

@Composable
fun MiniGuideOverlay(channel: Channel) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xDD172026))
            .padding(28.dp)
    ) {
        Text(channel.name, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.padding(4.dp))
        Text("Jetzt: ${channel.name} Live", color = Color.White, fontSize = 18.sp)
        Text("Danach: ${channel.name} Magazin", color = Color(0xFFD7E3E8), fontSize = 18.sp)
    }
}
