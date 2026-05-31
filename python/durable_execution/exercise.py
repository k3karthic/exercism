from __future__ import annotations

import asyncio
import random
from datetime import timedelta

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.worker import Worker

TASK_QUEUE = "durable-execution-task-queue"
TEMPORAL_TARGET = "localhost:7233"


@activity.defn
async def get_random_number_activity() -> int:
    return random.randint(1, 100)


@activity.defn
async def double_number_activity(number: int) -> int:
    return number * 2


@workflow.defn
class DoublerWorkflow:
    @workflow.run
    async def run(self) -> int:
        number = await workflow.execute_activity(
            get_random_number_activity,
            start_to_close_timeout=timedelta(seconds=5),
        )
        return await workflow.execute_activity(
            double_number_activity,
            number,
            start_to_close_timeout=timedelta(seconds=5),
        )


async def run_workflow(client: Client) -> int:
    return await client.execute_workflow(
        DoublerWorkflow.run,
        id="durable-execution-workflow",
        task_queue=TASK_QUEUE,
    )


async def main() -> None:
    client = await Client.connect(TEMPORAL_TARGET)
    async with Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[DoublerWorkflow],
        activities=[get_random_number_activity, double_number_activity],
    ):
        result = await run_workflow(client)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
