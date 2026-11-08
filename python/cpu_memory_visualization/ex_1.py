# From https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_1/fibonacci.py
# From the Memray "holding onto memory" exercise:
# https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_2/holding_onto_memory.py
#
# This exercise demonstrates how to use memray to identify two different
# memory anti-patterns in a single file.
#
# There are three code paths below. Run memray to see which ones dominate:
#
#   uv run memray run -o ex_1_memray.bin ex_1.py
#   uv run memray flamegraph ex_1_memray.bin
#   uv run memray table ex_1_memray.bin
#
# The flamegraph and table reports will show all three paths, with the
# largest memory consumers standing out clearly.
#
#   process_fibonacci   —  Path A (problematic): retains a large list when only the sum is needed
#   process_image       —  Path B (problematic): holds lingering references to intermediate arrays
#   process_primes      —  Path C (clean): efficiently computes primes using a boolean array
#
# Hint: two of the three paths have memory issues — one stores too much,
# the other fails to release intermediates.

import sys
import numpy as np

sys.set_int_max_str_digits(0)


def fibonacci(length):
    """Path A — stores the entire sequence in a list, but only the sum is needed."""
    if length < 1:
        return []
    if length == 1:
        return [1]

    output = [1, 1]
    for i in range(length - 2):
        output.append(output[i] + output[i + 1])
    return output


def sieve_of_eratosthenes(limit):
    """Path B — efficiently computes primes using a boolean list and returns the list of primes."""
    if limit < 2:
        return []
    is_prime = [True] * (limit + 1)
    is_prime[0] = False
    is_prime[1] = False
    for i in range(2, int(limit**0.5) + 1):
        if is_prime[i]:
            for j in range(i * i, limit + 1, i):
                is_prime[j] = False
    return [i for i, prime in enumerate(is_prime) if prime]


def process_image():
    """Path B — holds onto intermediate arrays via lingering references."""
    data = np.ones(5 * 1000 * 1000, dtype=np.uint8)
    data_pow = data - 3
    data_pow = np.power(data_pow, 2)
    result = data_pow * 2 + 10
    # Lingering references — data and data_pow are still alive in this scope
    # even though they are no longer needed after computing result.
    _unused = data  # keeps the original array alive
    _unused_pow = data_pow  # keeps the intermediate array alive
    return result


def process_fibonacci():
    """Entry point for Path A (problematic)."""
    return fibonacci(20000)


def process_image_entry():
    """Entry point for Path B (problematic)."""
    return process_image()


def process_primes():
    """Entry point for Path C (clean)."""
    return sieve_of_eratosthenes(200_000)


if __name__ == "__main__":
    # Keep all three results alive so all paths contribute to peak memory
    result_a = process_fibonacci()
    result_b = process_image_entry()
    result_c = process_primes()
    print(len(result_a))
    print(result_b)
    print(len(result_c))
