from __future__ import annotations

import sys
from pathlib import Path

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

DURABLE_EXECUTION_DIR = Path(__file__).resolve().parent
if str(DURABLE_EXECUTION_DIR) not in sys.path:
    sys.path.insert(0, str(DURABLE_EXECUTION_DIR))

import exercise as durable_execution  # noqa: E402


@pytest.mark.asyncio
async def test_doubler_workflow_runs_real_activities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    original_get_random_number_activity = durable_execution.get_random_number_activity
    original_double_number_activity = durable_execution.double_number_activity

    @activity.defn
    async def tracking_get_random_number_activity() -> int:
        calls.append("get_random_number_activity")
        return await original_get_random_number_activity()

    @activity.defn
    async def tracking_double_number_activity(number: int) -> int:
        calls.append("double_number_activity")
        return await original_double_number_activity(number)

    monkeypatch.setattr(durable_execution.random, "randint", lambda a, b: 21)
    monkeypatch.setattr(
        durable_execution,
        "get_random_number_activity",
        tracking_get_random_number_activity,
    )
    monkeypatch.setattr(
        durable_execution,
        "double_number_activity",
        tracking_double_number_activity,
    )

    async with await WorkflowEnvironment.start_local() as env:
        async with Worker(
            env.client,
            task_queue=durable_execution.TASK_QUEUE,
            workflows=[durable_execution.DoublerWorkflow],
            activities=[
                durable_execution.get_random_number_activity,
                durable_execution.double_number_activity,
            ],
        ):
            result = await durable_execution.run_workflow(env.client)

    assert result == 42
    assert calls == [
        "get_random_number_activity",
        "double_number_activity",
    ]
