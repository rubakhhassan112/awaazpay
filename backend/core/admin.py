from django.contrib import admin
from .models import Wallet, Merchant, Transaction


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("id", "balance", "is_setup", "updated_at")


@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ("name", "amount", "is_active_demo")
    list_editable = ("is_active_demo",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("reference", "counterparty", "amount", "direction", "status", "created_at")
    list_filter = ("direction", "status")
