import time
import multiprocessing
from multiprocessing import shared_memory
from concurrent.futures import ProcessPoolExecutor


def worker(start_idx, end_idx, shm_name):
    # Attach to existing shared memory
    shm = shared_memory.SharedMemory(name=shm_name)
    buf = shm.buf
    assert buf is not None

    for i in range(start_idx, end_idx):
        num = buf[i]
        print(
            f"Worker {multiprocessing.current_process().name} processing index {i}: {num}"
        )
        time.sleep(1)  # simulate work
        buf[i] = num * 2  # update shared memory

    shm.close()


def main():
    n = 10  # number of tasks

    # Create shared memory block of size n bytes
    shm = shared_memory.SharedMemory(create=True, size=n)
    buf = shm.buf
    assert buf is not None

    # Initialize shared memory with values 0..9
    for i in range(n):
        buf[i] = i

    # Partition work for 3 workers
    partitions = [(0, 4), (4, 7), (7, 10)]

    with ProcessPoolExecutor(max_workers=3) as executor:
        for start, end in partitions:
            executor.submit(worker, start, end, shm.name)

    # Read results
    results = [buf[i] for i in range(n)]
    print("Results:", results)

    shm.close()
    shm.unlink()


if __name__ == "__main__":
    multiprocessing.set_start_method("spawn")
    main()
