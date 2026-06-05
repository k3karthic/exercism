import time
import queue
from concurrent.futures import ThreadPoolExecutor

# Input and output queues
input_queue = queue.Queue()
output_queue = queue.Queue()


# Worker function
def worker(worker_id: int):
    while True:
        try:
            num = input_queue.get(timeout=1)  # wait for item
        except queue.Empty:
            break  # no more items, exit loop
        print(f"Worker {worker_id} {time.time()} processing {num}")
        time.sleep(1)  # simulate work
        result = num * 2
        output_queue.put(result)
        input_queue.task_done()


def main():
    # Fill input queue with integers
    for i in range(10):
        input_queue.put(i)

    # Use ThreadPoolExecutor with 3 worker threads
    with ThreadPoolExecutor(max_workers=3) as executor:
        for i in range(3):
            executor.submit(worker, i)

    # Wait until all tasks are processed
    input_queue.join()

    # Collect results
    results = []
    while not output_queue.empty():
        results.append(output_queue.get())

    print("Results:", results)


if __name__ == "__main__":
    main()
