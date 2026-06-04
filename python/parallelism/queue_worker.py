import time
import multiprocessing
from concurrent.futures import ProcessPoolExecutor


def worker(input_queue, output_queue):
    while True:
        try:
            num = input_queue.get(timeout=1)
        except Exception:
            break

        print(f"Worker {time.time()} processing {num}")
        time.sleep(1)
        result = num * 2
        output_queue.put(result)
        input_queue.task_done()


def main():
    manager = multiprocessing.Manager()
    input_queue = manager.Queue()
    output_queue = manager.Queue()

    # Fill input queue
    for i in range(10):
        input_queue.put(i)

    # Start 3 worker processes
    with ProcessPoolExecutor(max_workers=3) as executor:
        for _ in range(3):
            executor.submit(worker, input_queue, output_queue)

    # Wait for all tasks to finish
    input_queue.join()

    # Collect results
    results = []
    while not output_queue.empty():
        results.append(output_queue.get())

    print("Results:", results)


if __name__ == "__main__":
    multiprocessing.set_start_method("spawn")
    main()
