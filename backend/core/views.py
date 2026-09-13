import random
from decimal import Decimal, InvalidOperation

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import Wallet, Merchant, Transaction
from .serializers import WalletSerializer, MerchantSerializer, TransactionSerializer


# ---------------------------------------------------------------------------
# Wallet
# ---------------------------------------------------------------------------

@api_view(["GET"])
def wallet_detail(request):
    wallet = Wallet.get_solo()
    return Response(WalletSerializer(wallet).data)


@api_view(["POST"])
def wallet_setup(request):
    """Initial setup: user records their secret passphrase (PRD §11)."""
    phrase = (request.data.get("secret_phrase") or "").strip()
    if not phrase:
        return Response({"detail": "secret_phrase is required."}, status=status.HTTP_400_BAD_REQUEST)
    wallet = Wallet.get_solo()
    wallet.secret_phrase = phrase.lower()
    wallet.is_setup = True
    wallet.save()
    return Response(WalletSerializer(wallet).data)


# ---------------------------------------------------------------------------
# Merchants / NFC simulation (PRD §8-9)
# ---------------------------------------------------------------------------

@api_view(["GET"])
def merchant_list(request):
    merchants = Merchant.objects.all().order_by("id")
    return Response(MerchantSerializer(merchants, many=True).data)


@api_view(["POST"])
def nfc_detect(request):
    """
    Simulates an NFC terminal detection.
    If merchant_id is supplied (developer demo-mode selector), use it;
    otherwise pick the terminal flagged as the active demo terminal,
    falling back to a random one.
    """
    merchant_id = request.data.get("merchant_id")
    merchant = None
    if merchant_id:
        merchant = Merchant.objects.filter(id=merchant_id).first()
    if merchant is None:
        merchant = Merchant.objects.filter(is_active_demo=True).first()
    if merchant is None:
        merchant = Merchant.objects.order_by("?").first()
    if merchant is None:
        return Response({"detail": "No demo merchants configured."}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "merchant": MerchantSerializer(merchant).data,
    })


# ---------------------------------------------------------------------------
# Security challenge (PRD §11-12)
# ---------------------------------------------------------------------------

@api_view(["POST"])
def auth_challenge(request):
    """Generates a random two-digit challenge number for the secret-phrase check."""
    number = f"{random.randint(10, 99)}"
    return Response({"challenge_number": number})


@api_view(["POST"])
def auth_verify(request):
    """
    Validates the spoken response contains both the wallet's secret word
    and the issued challenge number. This is a hackathon-prototype check,
    not bank-grade or biometric authentication (PRD §12).
    """
    spoken_text = (request.data.get("spoken_text") or "").strip().lower()
    challenge_number = str(request.data.get("challenge_number") or "").strip()

    wallet = Wallet.get_solo()
    secret = wallet.secret_phrase.lower()

    phrase_ok = secret in spoken_text
    number_ok = challenge_number != "" and challenge_number in spoken_text

    return Response({
        "verified": bool(phrase_ok and number_ok),
        "phrase_ok": phrase_ok,
        "number_ok": number_ok,
    })


# ---------------------------------------------------------------------------
# Payment confirmation (PRD §13-15)
# ---------------------------------------------------------------------------

@api_view(["POST"])
def payment_confirm(request):
    merchant_name = (request.data.get("merchant_name") or "").strip()
    amount_raw = request.data.get("amount")

    if not merchant_name or amount_raw is None:
        return Response({"detail": "merchant_name and amount are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = Decimal(str(amount_raw))
    except InvalidOperation:
        return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

    wallet = Wallet.get_solo()

    if amount > wallet.balance:
        return Response({
            "detail": "Insufficient balance.",
            "wallet": WalletSerializer(wallet).data,
        }, status=status.HTTP_402_PAYMENT_REQUIRED)

    wallet.balance = wallet.balance - amount
    wallet.save()

    tx = Transaction.objects.create(
        counterparty=merchant_name,
        amount=amount,
        direction=Transaction.SENT,
        status=Transaction.STATUS_SUCCESS,
        balance_after=wallet.balance,
    )

    return Response({
        "transaction": TransactionSerializer(tx).data,
        "wallet": WalletSerializer(wallet).data,
    })


@api_view(["POST"])
def payment_cancel(request):
    """Logged for completeness; no wallet change on cancellation (PRD §10)."""
    merchant_name = (request.data.get("merchant_name") or "").strip()
    amount_raw = request.data.get("amount")
    wallet = Wallet.get_solo()

    if merchant_name and amount_raw is not None:
        try:
            amount = Decimal(str(amount_raw))
            Transaction.objects.create(
                counterparty=merchant_name,
                amount=amount,
                direction=Transaction.SENT,
                status=Transaction.STATUS_CANCELLED,
                balance_after=wallet.balance,
            )
        except InvalidOperation:
            pass

    return Response({"cancelled": True})


# ---------------------------------------------------------------------------
# Receive money (PRD §16)
# ---------------------------------------------------------------------------

@api_view(["POST"])
def receive_money(request):
    sender = (request.data.get("sender") or "Ahmed").strip()
    amount_raw = request.data.get("amount", "5000")

    try:
        amount = Decimal(str(amount_raw))
    except InvalidOperation:
        return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)

    wallet = Wallet.get_solo()
    wallet.balance = wallet.balance + amount
    wallet.save()

    tx = Transaction.objects.create(
        counterparty=sender,
        amount=amount,
        direction=Transaction.RECEIVED,
        status=Transaction.STATUS_SUCCESS,
        balance_after=wallet.balance,
    )

    return Response({
        "transaction": TransactionSerializer(tx).data,
        "wallet": WalletSerializer(wallet).data,
    })


# ---------------------------------------------------------------------------
# Transaction history (PRD §17)
# ---------------------------------------------------------------------------

@api_view(["GET"])
def transaction_list(request):
    limit = request.GET.get("limit")
    qs = Transaction.objects.all()
    if limit:
        try:
            qs = qs[: int(limit)]
        except ValueError:
            pass
    return Response(TransactionSerializer(qs, many=True).data)
