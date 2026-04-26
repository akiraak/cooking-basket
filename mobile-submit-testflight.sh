#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/mobile"
exec eas build --profile production --platform ios --auto-submit "$@"
