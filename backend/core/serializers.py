from rest_framework import serializers
from .models import Wallet, Merchant, Transaction


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ["balance", "is_setup", "updated_at"]


class MerchantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Merchant
        fields = ["id", "name", "amount"]


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            "id", "reference", "counterparty", "amount",
            "direction", "status", "balance_after", "created_at",
        ]
