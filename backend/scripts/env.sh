#!/bin/bash

# Shared environment setup for backend scripts

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"

  # DATABASE_URL must be set via Render environment variables (Supabase PostgreSQL).
  # Do NOT override it here with a SQLite path.
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERROR: DATABASE_URL is not set. Configure it in Render environment variables." >&2
    exit 1
  fi
else
  echo "Starting in development mode..."
  export NODE_ENV="development"
fi
