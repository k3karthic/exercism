import multiprocessing
import time
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import shared_memory


def worker(start_idx, end_idx, shm_name):
    shm = shared_memory.SharedMemory(name=shm_name)
    buf = shm.buf
    assert buf is not None

    for i in range(start_idx, end_idx):
        num = buf[i]
        print(f"Worker {multiprocessing.current_process().name} processing index {i}: {num}")
        time.sleep(1)
        buf[i] = num * 2

    shm.close()


def main():
    n = 10

    shm = shared_memory.SharedMemory(create=True, size=n)
    buf = shm.buf
    assert buf is not None

    for i in range(n):
        buf[i] = i

    partitions = [(0, 4), (4, 7), (7, 10)]

    with ProcessPoolExecutor(max_workers=3) as executor:
        for start, end in partitions:
            executor.submit(worker, start, end, shm.name)

    results = [buf[i] for i in range(n)]
    print("Results:", results)

    shm.close()
    shm.unlink()


if __name__ == "__main__":
    multiprocessing.set_start_method("spawn")
    main()
