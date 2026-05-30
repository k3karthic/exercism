from __future__ import annotations

from testcontainers.redis import RedisContainer

import redis


def main() -> None:
    with RedisContainer("redis:7-alpine") as container:
        client: redis.Redis = container.get_client(decode_responses=True)

        client.set("foo", "bar")
        value = client.get("foo")
        assert value == "bar"
        print(value)


if __name__ == "__main__":
    main()
