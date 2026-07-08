"""Runtime configuration.

Every value is read from environment variables (see the repo-root .env).
Required settings have no default: the service fails fast at startup when
one is missing rather than limping along misconfigured.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Neon PostgreSQL (libpq URL, sslmode=require&channel_binding=require)
    database_url: str

    # Upstash Redis over TCP with TLS
    redis_host: str
    redis_port: int = 6379
    redis_password: str
    redis_ssl: bool = True

    # CloudAMQP LavinMQ over AMQPS
    rabbitmq_host: str
    rabbitmq_port: int = 5671
    rabbitmq_username: str
    rabbitmq_password: str
    rabbitmq_vhost: str
    rabbitmq_ssl: bool = True

    # Messaging topology (shared with the Java API and .NET worker)
    exchange_name: str = "alerts.topic"
    queue_name: str = "q.ml.alert-created"

    model_version: str = "severity-tfidf-lr-1.0.0"
    hotspot_cache_ttl_seconds: int = 300


def load_settings() -> Settings:
    return Settings()
