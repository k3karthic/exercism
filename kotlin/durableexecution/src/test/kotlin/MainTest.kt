package com.github.k3karthic.durableexecution

import com.github.k3karthic.durableexecution.temporal.activity.DoublerActivityImpl
import com.github.k3karthic.durableexecution.temporal.workflow.DoublerWorkflowImpl
import com.github.k3karthic.durableexecution.temporal.workflow.DoublerWorkflowInterface
import io.mockk.every
import io.mockk.spyk
import io.temporal.testing.TestWorkflowEnvironment
import io.temporal.testing.TestWorkflowExtension
import io.temporal.worker.Worker
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.extension.RegisterExtension
import kotlin.test.Test
import kotlin.test.assertEquals

internal class MainTest {
    companion object {
        val activityImpl = spyk(DoublerActivityImpl())

        @JvmField
        @RegisterExtension
        val testWorkflowExtension: TestWorkflowExtension =
            TestWorkflowExtension
                .newBuilder()
                .registerWorkflowImplementationTypes(DoublerWorkflowImpl::class.java)
                .setActivityImplementations(activityImpl)
                .build()
    }

    @BeforeEach
    fun setUp() {
        every { activityImpl.getRandomNumber() } returns 12.0
    }

    @Test
    fun testDemo(
        testEnv: TestWorkflowEnvironment,
        worker: Worker,
        workflow: DoublerWorkflowInterface,
    ) {
        val result = workflow.run()
        assertEquals(144.0, result)
    }
}
