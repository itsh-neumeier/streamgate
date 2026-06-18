package io.streamgate.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ActivationScreen(error: String?, onActivate: (String) -> Unit) {
    val code = remember { mutableStateOf("") }
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("StreamGate TV", color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Bold)
        OutlinedTextField(
            value = code.value,
            onValueChange = { code.value = it.uppercase() },
            modifier = Modifier.width(320.dp),
            singleLine = true,
            label = { Text("Aktivierungscode") }
        )
        Button(onClick = { onActivate(code.value) }) {
            Text("Aktivieren")
        }
        if (error != null) Text(error, color = Color(0xFFFFC857))
    }
}
