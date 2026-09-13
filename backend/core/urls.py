from django.urls import path
from . import views

urlpatterns = [
    path("wallet/", views.wallet_detail, name="wallet-detail"),
    path("wallet/setup/", views.wallet_setup, name="wallet-setup"),

    path("merchants/", views.merchant_list, name="merchant-list"),
    path("nfc/detect/", views.nfc_detect, name="nfc-detect"),

    path("auth/challenge/", views.auth_challenge, name="auth-challenge"),
    path("auth/verify/", views.auth_verify, name="auth-verify"),

    path("payment/confirm/", views.payment_confirm, name="payment-confirm"),
    path("payment/cancel/", views.payment_cancel, name="payment-cancel"),

    path("receive/", views.receive_money, name="receive-money"),

    path("transactions/", views.transaction_list, name="transaction-list"),
]
