## Threads

Use a ThreadPoolExecutor to execute multiple functions concurrently.
This works well for synchronous calls that will block the calling thread.

Run program,
```bash
uv run concurrency/_threads.py
```

## Async

Use asyncio to execute multiple functions concurrently in an event loop.
The event loop is based on cooperatively scheduled coroutines and should only be used with asynchronous function calls.
Calling a synchronous function from the event loop can lead to the call hogging the CPU which can lead to deadlocks or hung servers.

Run program,
```bash
uv run concurrency/_async.py
```