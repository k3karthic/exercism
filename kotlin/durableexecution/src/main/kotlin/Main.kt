package com.github.k3karthic.durableexecution

import com.github.k3karthic.durableexecution.temporal.activity.DoublerActivityImpl
import com.github.k3karthic.durableexecution.temporal.workflow.DoublerWorkflowImpl
import com.github.k3karthic.durableexecution.temporal.workflow.DoublerWorkflowInterface
import io.temporal.client.WorkflowClient
import io.temporal.client.WorkflowOptions
import io.temporal.serviceclient.WorkflowServiceStubs
import io.temporal.worker.WorkerFactory

fun main() {
    val serviceStub = WorkflowServiceStubs.newLocalServiceStubs()
    val client = WorkflowClient.newInstance(serviceStub)

    val taskQueue = "doubler-task-queue"

    val factory = WorkerFactory.newInstance(client)

    val worker = factory.newWorker(taskQueue)
    worker.registerWorkflowImplementationTypes(DoublerWorkflowImpl::class.java)
    worker.registerActivitiesImplementations(DoublerActivityImpl())

    factory.start()

    val workflow =
        client.newWorkflowStub(
            DoublerWorkflowInterface::class.java,
            WorkflowOptions
                .newBuilder()
                .setTaskQueue(taskQueue)
                .setWorkflowId("doubler-workflow")
                .build(),
        )

    val we = WorkflowClient.execute<Double> { workflow.run() }

    println(we.get())

    factory.shutdown()
}
