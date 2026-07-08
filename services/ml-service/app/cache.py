"""Upstash Redis (TCP + TLS) JSON cache with fail-open semantics: a cache
outage degrades to recomputation, never to an error for the caller."""

from __future__ import annotations

import json
import logging
from typing import Any

import redis

from .config import Settings

log = logging.getLogger(__name__)


class Cache:
    def __init__(self, settings: Settings) -> None:
        self._client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password,
            ssl=settings.redis_ssl,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
        )

    def get_json(self, key: str) -> Any | None:
        try:
            raw = self._client.get(key)
            return json.loads(raw) if raw else None
        except (redis.RedisError, json.JSONDecodeError) as exc:
            log.warning("Redis read failed for %s: %s", key, exc)
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int) -> None:
        try:
            self._client.set(key, json.dumps(value), ex=ttl_seconds)
        except redis.RedisError as exc:
            log.warning("Redis write failed for %s: %s", key, exc)
