import queue
import time
from concurrent.futures import ThreadPoolExecutor
from queue import Queue

input_queue: Queue[int] = queue.Queue()
output_queue: Queue[int] = queue.Queue()


def worker(worker_id: int):
    while True:
        try:
            num = input_queue.get(timeout=1)
        except queue.Empty:
            break

        print(f"Worker {worker_id} {time.time()} processing {num}")
        time.sleep(1)
        result = num * 2
        output_queue.put(result)

        input_queue.task_done()


def main():
    for i in range(10):
        input_queue.put(i)

    with ThreadPoolExecutor(max_workers=3) as executor:
        for i in range(3):
            executor.submit(worker, i)

    input_queue.join()

    results = []
    while not output_queue.empty():
        results.append(output_queue.get())

    print("Results:", results)


if __name__ == "__main__":
    main()
