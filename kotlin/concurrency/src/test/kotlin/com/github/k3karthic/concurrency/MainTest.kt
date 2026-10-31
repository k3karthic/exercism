package com.github.k3karthic.concurrency

import kotlin.test.Test
import kotlin.test.assertEquals

internal class MainTest {
    @Test
    fun testDemo() {
        val results = runDemo()

        assertEquals(3, results.size)
        assertEquals(2, results[0])
        assertEquals(4, results[1])
        assertEquals(6, results[2])
    }
}
