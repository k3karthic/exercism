package com.github.k3karthic.durableexecution.temporal.workflow

import io.temporal.workflow.WorkflowInterface
import io.temporal.workflow.WorkflowMethod

@WorkflowInterface
interface DoublerWorkflowInterface {
    @WorkflowMethod
    fun run(): Double
}
