# From the Memray "LRU Cache" exercise:
# https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_3/lru_cache.py
#
# This exercise demonstrates how to use memray to identify unexpected memory
# consumption caused by caching strategies.
#
# There are three code paths below. Run memray to see which one dominates:
#
#   uv run memray run -o ex_2_memray.bin ex_2.py
#   uv run memray flamegraph ex_2_memray.bin
#   uv run memray table ex_2_memray.bin
#
# The flamegraph and table reports will show all three paths, with the
# largest memory consumer standing out clearly.
#
#   compute_hashed    —  Path A: uses a bounded dictionary cache
#   compute_cached    —  Path B: uses an unbounded cache that grows with every unique call
#   compute_streaming —  Path C: computes values iteratively, storing results in a list
#
# For CPU profiling, use viztracer to see which path dominates execution time:
#
#   uv run viztracer ex_2.py
#   uv run vizviewer result.json

import functools


def compute_hashed():
    """Path A — uses a bounded dictionary cache, memory stays under control."""
    cache = {}
    max_size = 100

    def fib(n):
        if n in cache:
            return cache[n]
        if n < 2:
            return n
        result = fib(n - 1) + fib(n - 2)
        if len(cache) < max_size:
            cache[n] = result
        return result

    # Store results in a list so they contribute to peak memory
    results = []
    for i in range(40):
        results.append(fib(i))
    return results


@functools.cache
def factorial_cached(n):
    """Path B — unbounded cache: every unique n is stored forever."""
    if n < 2:
        return 1
    return n * factorial_cached(n - 1)


def compute_cached():
    """Entry point for Path B — calls factorial with many unique values."""
    # Store results so they contribute to peak memory
    results = []
    for i in range(1000):
        results.append(factorial_cached(i))
    return results


def compute_streaming():
    """Path C — computes factorials iteratively, storing results in a list."""
    results = []
    running = 1
    for i in range(1, 1001):
        running *= i
        results.append(running)
    return results


if __name__ == "__main__":
    # Keep all three results alive so all paths contribute to peak memory
    result_a = compute_hashed()
    result_b = compute_cached()
    result_c = compute_streaming()
    print(len(result_a))
    print(len(result_b))
    print(len(result_c))
