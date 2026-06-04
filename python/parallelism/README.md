Use a ProcessPoolExecutor for CPU bound tasks as this executor will spin up multiple Python interpreters.
As these are independent interpreters, they are not bound to a single GIL.

```bash
uv run parallelism/queue_worker.py
```

```bash
uv run parallelism/shared_memory_worker.py
```