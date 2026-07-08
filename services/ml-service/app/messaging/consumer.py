"""AMQPS consumer: scores every alert.created event and publishes the result.

Runs on a daemon thread beside the FastAPI event loop (pika's
BlockingConnection is intentionally kept off asyncio). Reconnects with
exponential backoff; unprocessable messages are dead-lettered, not requeued.
"""

from __future__ import annotations

import json
import logging
import ssl
import threading
import time
from datetime import datetime, timezone

import pika
import pika.exceptions

from ..config import Settings
from ..models.severity import SeverityModel

log = logging.getLogger(__name__)

EXCHANGE_TYPE = "topic"
DEAD_LETTER_EXCHANGE = "alerts.dlx"
DEAD_LETTER_QUEUE = "q.dead-letter"
ROUTING_KEY_CREATED = "alert.created"
ROUTING_KEY_SCORED = "alert.scored"
_MAX_BACKOFF_SECONDS = 30


class AlertScoringConsumer(threading.Thread):
    def __init__(self, settings: Settings, model: SeverityModel) -> None:
        super().__init__(name="alert-scoring-consumer", daemon=True)
        self._settings = settings
        self._model = model
        self._stopping = threading.Event()
        self._connection: pika.BlockingConnection | None = None
        self._channel = None

    def _connection_parameters(self) -> pika.ConnectionParameters:
        settings = self._settings
        ssl_options = None
        if settings.rabbitmq_ssl:
            context = ssl.create_default_context()
            ssl_options = pika.SSLOptions(context, server_hostname=settings.rabbitmq_host)
        return pika.ConnectionParameters(
            host=settings.rabbitmq_host,
            port=settings.rabbitmq_port,
            virtual_host=settings.rabbitmq_vhost,
            credentials=pika.PlainCredentials(settings.rabbitmq_username, settings.rabbitmq_password),
            ssl_options=ssl_options,
            heartbeat=60,
            blocked_connection_timeout=30,
        )

    def run(self) -> None:
        backoff = 1.0
        while not self._stopping.is_set():
            try:
                self._consume_until_stopped()
                backoff = 1.0
            except pika.exceptions.AMQPError as exc:
                if self._stopping.is_set():
                    break
                log.warning("AMQP connection lost (%s); retrying in %.0fs", exc, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, _MAX_BACKOFF_SECONDS)
        log.info("Alert scoring consumer stopped")

    def _consume_until_stopped(self) -> None:
        settings = self._settings
        self._connection = pika.BlockingConnection(self._connection_parameters())
        self._channel = channel = self._connection.channel()

        channel.exchange_declare(settings.exchange_name, EXCHANGE_TYPE, durable=True)
        channel.exchange_declare(DEAD_LETTER_EXCHANGE, "fanout", durable=True)
        channel.queue_declare(DEAD_LETTER_QUEUE, durable=True)
        channel.queue_bind(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, routing_key="")
        channel.queue_declare(
            settings.queue_name,
            durable=True,
            arguments={"x-dead-letter-exchange": DEAD_LETTER_EXCHANGE},
        )
        channel.queue_bind(settings.queue_name, settings.exchange_name, ROUTING_KEY_CREATED)
        channel.basic_qos(prefetch_count=8)
        channel.basic_consume(settings.queue_name, self._on_message)

        log.info(
            "Consuming %s on %s:%s/%s",
            settings.queue_name, settings.rabbitmq_host,
            settings.rabbitmq_port, settings.rabbitmq_vhost,
        )
        channel.start_consuming()

    def _on_message(self, channel, method, properties, body) -> None:
        try:
            payload = json.loads(body)
            prediction = self._model.predict(payload["description"])
            event = {
                "alertId": payload["alertId"],
                "severity": prediction.severity,
                "riskScore": prediction.risk_score,
                "modelVersion": prediction.model_version,
                "category": payload["category"],
                "lat": payload["lat"],
                "lng": payload["lng"],
                "scoredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            channel.basic_publish(
                exchange=self._settings.exchange_name,
                routing_key=ROUTING_KEY_SCORED,
                body=json.dumps(event).encode("utf-8"),
                properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
            )
            channel.basic_ack(method.delivery_tag)
            log.info(
                "Scored alert %s as %s (risk %.2f)",
                payload["alertId"], prediction.severity, prediction.risk_score,
            )
        except Exception:
            log.exception("Failed to score message; dead-lettering")
            channel.basic_nack(method.delivery_tag, requeue=False)

    def stop(self) -> None:
        self._stopping.set()
        connection = self._connection
        if connection is not None and connection.is_open:
            try:
                connection.add_callback_threadsafe(self._channel.stop_consuming)
            except pika.exceptions.AMQPError:
                pass
        self.join(timeout=10)
