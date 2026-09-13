#!/usr/bin/env bash
# Render runs this on every deploy (see render.yaml -> buildCommand).
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
