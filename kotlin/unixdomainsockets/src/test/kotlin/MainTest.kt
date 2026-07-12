package com.github.k3karthic.unixdomainsockets

import kotlin.io.path.createTempFile
import kotlin.test.Test
import kotlin.test.assertEquals

internal class MainTest {
    @Test
    fun testDemo() {
        val temp = createTempFile()
        val tempFile = temp.toFile()
        tempFile.deleteOnExit()

        val result = runDemo(tempFile.absolutePath)

        assertEquals(result.input * result.input, result.output)
    }
}
