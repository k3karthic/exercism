import asyncio
import time
from asyncio import Queue

input_queue: Queue[int] = Queue()
output_queue: Queue[int] = Queue()


async def worker(worker_id: int):
    while True:
        try:
            num = await asyncio.wait_for(input_queue.get(), timeout=1)
        except TimeoutError:
            break

        print(f"Worker {worker_id} {time.time()} processing {num}")
        await asyncio.sleep(1)
        result = num * 2
        await output_queue.put(result)

        input_queue.task_done()


async def main():
    for i in range(10):
        await input_queue.put(i)

    workers = [asyncio.create_task(worker(worker_id=i)) for i in range(3)]

    await input_queue.join()

    for w in workers:
        w.cancel()

    results = []
    while not output_queue.empty():
        results.append(await output_queue.get())

    print("Results:", results)


if __name__ == "__main__":
    asyncio.run(main())
