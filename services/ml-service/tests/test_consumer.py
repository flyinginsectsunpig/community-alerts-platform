"""The consumer's publish decision.

`AlertScoredEvent.riskScore` is a non-nullable `double` in both the Java API
and the .NET worker, so a null risk score cannot go on the wire — System.Text.Json
throws on it. An abstention therefore publishes nothing: the alert keeps the
UNSCORED severity and NULL risk_score it was created with.
"""

import json
from types import SimpleNamespace

import pytest

from app.messaging.consumer import ROUTING_KEY_SCORED, AlertScoringConsumer
from app.models.severity import SeverityModel


class FakeChannel:
    """Records what the consumer would have done to the broker."""

    def __init__(self) -> None:
        self.published: list[dict] = []
        self.acked: list[int] = []
        self.nacked: list[int] = []

    def basic_publish(self, exchange, routing_key, body, properties=None) -> None:
        self.published.append(
            {"exchange": exchange, "routing_key": routing_key, "body": json.loads(body)}
        )

    def basic_ack(self, delivery_tag) -> None:
        self.acked.append(delivery_tag)

    def basic_nack(self, delivery_tag, requeue=False) -> None:
        self.nacked.append(delivery_tag)


@pytest.fixture(scope="module")
def consumer() -> AlertScoringConsumer:
    settings = SimpleNamespace(exchange_name="alerts.topic")
    return AlertScoringConsumer(settings, SeverityModel("test-model"))


def message(description: str) -> bytes:
    return json.dumps(
        {
            "alertId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
            "category": "THEFT",
            "description": description,
            "lat": -33.92,
            "lng": 18.42,
        }
    ).encode("utf-8")


def test_scored_alert_is_published(consumer: AlertScoringConsumer) -> None:
    channel = FakeChannel()
    consumer._on_message(channel, SimpleNamespace(delivery_tag=1), None, message(
        "Man waving a gun outside the pharmacy"
    ))

    assert len(channel.published) == 1
    assert channel.published[0]["routing_key"] == ROUTING_KEY_SCORED
    assert channel.published[0]["body"]["severity"] == "CRITICAL"
    assert channel.acked == [1]
    assert channel.nacked == []


def test_abstained_alert_is_acked_without_publishing_a_score(
    consumer: AlertScoringConsumer,
) -> None:
    channel = FakeChannel()
    consumer._on_message(channel, SimpleNamespace(delivery_tag=2), None, message("asdasdsasfa"))

    assert channel.published == []
    # Acked, not dead-lettered: an unscorable report is a valid outcome, not a
    # processing failure.
    assert channel.acked == [2]
    assert channel.nacked == []


def test_unparseable_message_is_dead_lettered(consumer: AlertScoringConsumer) -> None:
    channel = FakeChannel()
    consumer._on_message(channel, SimpleNamespace(delivery_tag=3), None, b"not json")

    assert channel.published == []
    assert channel.acked == []
    assert channel.nacked == [3]
