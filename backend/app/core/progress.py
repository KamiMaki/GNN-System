"""Redis-based real-time progress tracking for training tasks.

Provides fast ephemeral progress updates during training (written to Redis),
while final task state is persisted to MongoDB via store.update_task().
"""

import json

import redis

from app.core.config import settings

_redis = redis.Redis.from_url(
    settings.REDIS_URL,
    db=settings.REDIS_PROGRESS_DB,
    decode_responses=True,
)


def update_progress(task_id: str, **kwargs) -> None:
    """Write progress fields to a Redis hash. Auto-expires after 1 hour."""
    mapping = {}
    for k, v in kwargs.items():
        if isinstance(v, (dict, list)):
            mapping[k] = json.dumps(v)
        elif v is None:
            mapping[k] = ""
        else:
            mapping[k] = str(v)
    _redis.hset(f"task_progress:{task_id}", mapping=mapping)
    _redis.expire(f"task_progress:{task_id}", 3600)


def get_progress(task_id: str) -> dict | None:
    """Read current progress from Redis. Returns None if no data."""
    data = _redis.hgetall(f"task_progress:{task_id}")
    if not data:
        return None
    result = {}
    for k, v in data.items():
        try:
            result[k] = json.loads(v)
        except (json.JSONDecodeError, TypeError):
            result[k] = v
    return result


def delete_progress(task_id: str) -> None:
    """Remove progress data after training completes."""
    _redis.delete(f"task_progress:{task_id}")
