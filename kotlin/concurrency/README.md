The event loop is a good fit for IO bound tasks because it can keep moving while work waits on external resources.
It uses cooperatively scheduled coroutines, so it works best with non-blocking calls.
Calling a synchronous function from the event loop can hog the CPU and block other work.

## Run Program

```bash
./gradlew :concurrency:run
```
