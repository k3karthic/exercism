package com.github.k3karthic.parallelism

import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals

internal class MainTest {
    @Test
    fun testDemo() {
        val results = runDemo()

        assertEquals(results.size, 3)

        assertContains(results, 9)
        assertContains(results, 1)
        assertContains(results, 4)
    }
}
