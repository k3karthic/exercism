package com.github.k3karthic.durableexecution.temporal.workflow

import com.github.k3karthic.durableexecution.temporal.activity.DoublerActivityInterface
import io.temporal.activity.ActivityOptions
import io.temporal.common.RetryOptions
import io.temporal.workflow.Workflow
import java.time.Duration

class DoublerWorkflowImpl : DoublerWorkflowInterface {
    val activity =
        Workflow.newActivityStub(
            DoublerActivityInterface::class.java,
            ActivityOptions
                .newBuilder()
                .setRetryOptions(RetryOptions.newBuilder().build())
                .setStartToCloseTimeout(Duration.ofSeconds(1))
                .build(),
        )!!

    override fun run(): Double {
        val num = activity.getRandomNumber()
        return activity.doubleNumber(num)
    }
}
