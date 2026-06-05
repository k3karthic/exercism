import asyncio
import time
from asyncio import Queue


# Input and output queues
input_queue = Queue()
output_queue = Queue()


# Worker coroutine
async def worker(worker_id: int):
    while True:
        try:
            num = await asyncio.wait_for(input_queue.get(), timeout=1)
        except asyncio.TimeoutError:
            break  # no more items
        print(f"Worker {worker_id} {time.time()} processing {num}")
        await asyncio.sleep(1)  # simulate async work
        result = num * 2
        await output_queue.put(result)
        input_queue.task_done()


async def main():
    # Fill input queue
    for i in range(10):
        await input_queue.put(i)

    # Create 3 async workers
    workers = [asyncio.create_task(worker(worker_id=i)) for i in range(3)]

    # Wait for all tasks to finish
    await input_queue.join()

    # Cancel workers (they exit naturally after timeout)
    for w in workers:
        w.cancel()

    # Collect results
    results = []
    while not output_queue.empty():
        results.append(await output_queue.get())

    print("Results:", results)


if __name__ == "__main__":
    asyncio.run(main())
