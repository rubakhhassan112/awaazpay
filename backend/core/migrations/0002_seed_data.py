from django.db import migrations


def seed(apps, schema_editor):
    Merchant = apps.get_model("core", "Merchant")
    Wallet = apps.get_model("core", "Wallet")

    Wallet.objects.get_or_create(pk=1, defaults={"balance": 25000, "secret_phrase": "falcon"})

    demo_merchants = [
        ("ABC Grocery Store", 2500, True),
        ("Karachi Coffee House", 750, False),
        ("City Pharmacy", 1200, False),
    ]
    for name, amount, active in demo_merchants:
        Merchant.objects.get_or_create(name=name, defaults={"amount": amount, "is_active_demo": active})


def unseed(apps, schema_editor):
    Merchant = apps.get_model("core", "Merchant")
    Merchant.objects.filter(name__in=[
        "ABC Grocery Store", "Karachi Coffee House", "City Pharmacy",
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
