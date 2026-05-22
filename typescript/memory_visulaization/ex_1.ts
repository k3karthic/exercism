// Translated From https://github.com/bloomberg/memray/blob/main/docs/tutorials/exercise_1/fibonacci.py

function fibonacci(length: number): number[] {
	if (length < 1) {
		return [];
	}
	if (length === 1) {
		return [1];
	}
	if (length === 2) {
		return [1, 1];
	}

	const output = [1, 1];

	for (let i = 0; i < length - 2; i += 1) {
		output.push(output[i]! + output[i + 1]!);
	}

	return output;
}

function chain<T>(...iterables: Iterable<T>[]): T[] {
	return iterables.flatMap((iterable) => Array.from(iterable));
}

function generateFibonacciHash(
	length_1: number,
	length_2: number,
	length_3: number,
): number {
	return (
		chain(fibonacci(length_1), fibonacci(length_2), fibonacci(length_3)).reduce(
			(total, value) => total + value,
			0,
		) % 10000
	);
}

// DO NOT CHANGE
const LENGTH_OF_SEQUENCE_1 = 33333
const LENGTH_OF_SEQUENCE_2 = 30000
const LENGTH_OF_SEQUENCE_3 = 34567
// DO NOT CHANGE
generateFibonacciHash(
	LENGTH_OF_SEQUENCE_1, LENGTH_OF_SEQUENCE_2, LENGTH_OF_SEQUENCE_3
);
