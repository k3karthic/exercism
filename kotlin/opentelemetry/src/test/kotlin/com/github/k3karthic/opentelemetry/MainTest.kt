package com.github.k3karthic.opentelemetry

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class MainTest {
    val service1 = Service1()

    @Test
    fun test() {
        val method = Service1::class.java.getDeclaredMethod("runInternal", List::class.java)
        method.isAccessible = true

        val rawResultList = method.invoke(service1, listOf("3.0", "2a"))

        @Suppress("UNCHECKED_CAST")
        val resultList = rawResultList as List<ServiceResult>

        assertNull(resultList[0].error)
        assertEquals(9.0, resultList[0].output)
        assertNotNull(resultList[1].error)
        assertNull(resultList[1].output)
    }
}
