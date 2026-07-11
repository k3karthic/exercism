package com.github.k3karthic.concurrency

import kotlin.test.Test
import kotlin.test.assertEquals

internal class MainTest {
    @Test
    fun testDemo() {
        val results = runDemo()

        assertEquals(results.size, 3)
        assertEquals(results[0], 2)
        assertEquals(results[1], 4)
        assertEquals(results[2], 6)
    }
}
