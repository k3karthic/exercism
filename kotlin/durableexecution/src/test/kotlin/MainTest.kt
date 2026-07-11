package com.github.k3karthic.durableexecution

import com.github.k3karthic.durableexecution.temporal.activity.DoublerActivityImpl
import com.github.k3karthic.durableexecution.temporal.workflow.DoublerWorkflowImpl
import com.github.k3karthic.durableexecution.temporal.workflow.DoublerWorkflowInterface
import io.temporal.testing.TestWorkflowEnvironment
import io.temporal.testing.TestWorkflowExtension
import io.temporal.worker.Worker
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.extension.RegisterExtension
import kotlin.test.Test

internal class MainTest {
    companion object {
        @JvmField
        @RegisterExtension
        val testWorkflowExtension: TestWorkflowExtension =
            TestWorkflowExtension
                .newBuilder()
                .registerWorkflowImplementationTypes(DoublerWorkflowImpl::class.java)
                .setActivityImplementations(DoublerActivityImpl())
                .build()
    }

    @Test
    fun testDemo(
        testEnv: TestWorkflowEnvironment,
        worker: Worker,
        workflow: DoublerWorkflowInterface,
    ) {
        assertDoesNotThrow { workflow.run() }
    }
}
