import uuid
from django.db import models


def _new_reference():
    return uuid.uuid4().hex[:10].upper()


class Wallet(models.Model):
    """
    Single demo wallet for the hackathon prototype.
    AwaazPay MVP has no multi-user banking — one simulated wallet,
    one simulated identity, per PRD section 6 (MVP Scope).
    """
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=25000)
    secret_phrase = models.CharField(max_length=100, default="falcon")
    is_setup = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Wallet(balance={self.balance})"


class Merchant(models.Model):
    """Simulated NFC payment terminals, per PRD section 21 (Demo Merchants)."""
    name = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_active_demo = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} — PKR {self.amount}"


class Transaction(models.Model):
    SENT = "sent"
    RECEIVED = "received"
    DIRECTION_CHOICES = [(SENT, "Sent"), (RECEIVED, "Received")]

    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    reference = models.CharField(max_length=20, unique=True, default=_new_reference)
    counterparty = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_SUCCESS)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.direction} {self.amount} {self.counterparty} [{self.status}]"
