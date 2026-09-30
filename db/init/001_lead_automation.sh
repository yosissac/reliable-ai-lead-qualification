#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${LEAD_DB_USER:-}" || -z "${LEAD_DB_PASSWORD:-}" ]]; then
  echo "LEAD_DB_USER and LEAD_DB_PASSWORD are required" >&2
  exit 1
fi

psql --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=lead_db_user="$LEAD_DB_USER" \
  --set=lead_db_password="$LEAD_DB_PASSWORD" <<'EOSQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'lead_db_user', :'lead_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'lead_db_user') \gexec

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS lead_automation;

CREATE TABLE IF NOT EXISTS lead_automation.lead_processing (
  submission_id varchar(64) PRIMARY KEY,
  payload_hash char(64) NOT NULL,
  lead_payload jsonb NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN (
    'RECEIVED',
    'PROCESSING',
    'CLASSIFIED',
    'SHEET_WRITTEN',
    'COMPLETED',
    'FAILED_LLM',
    'FAILED_LLM_OUTPUT',
    'FAILED_SHEETS',
    'FAILED_NOTIFICATION',
    'FAILED_PERMANENT'
  )),
  classification jsonb,
  guardrail_overridden boolean NOT NULL DEFAULT false,
  ai_model varchar(100),
  ai_call_count integer NOT NULL DEFAULT 0 CHECK (ai_call_count >= 0),
  ai_completed_at timestamptz,
  sheet_row_reference varchar(100),
  sheet_written_at timestamptz,
  notification_client_id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_reference varchar(100),
  notification_sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_retry_at timestamptz,
  last_error_code varchar(80),
  last_error_message varchar(500),
  locked_by varchar(100),
  lock_until timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT classification_required_after_ai CHECK (
    status IN ('RECEIVED', 'PROCESSING', 'FAILED_LLM', 'FAILED_LLM_OUTPUT', 'FAILED_PERMANENT')
    OR classification IS NOT NULL
  )
);

-- Recreate the constraint so re-running this initialization script also
-- upgrades databases created before FAILED_PERMANENT could occur pre-classification.
ALTER TABLE lead_automation.lead_processing
  DROP CONSTRAINT IF EXISTS classification_required_after_ai;
ALTER TABLE lead_automation.lead_processing
  ADD CONSTRAINT classification_required_after_ai CHECK (
    status IN ('RECEIVED', 'PROCESSING', 'FAILED_LLM', 'FAILED_LLM_OUTPUT', 'FAILED_PERMANENT')
    OR classification IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS lead_processing_retry_idx
  ON lead_automation.lead_processing (next_retry_at, status)
  WHERE status IN ('FAILED_LLM', 'FAILED_LLM_OUTPUT', 'FAILED_SHEETS', 'FAILED_NOTIFICATION');

CREATE INDEX IF NOT EXISTS lead_processing_lease_idx
  ON lead_automation.lead_processing (lock_until)
  WHERE lock_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_automation.processing_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id varchar(64) NOT NULL REFERENCES lead_automation.lead_processing(submission_id),
  event_type varchar(80) NOT NULL,
  event_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processing_events_submission_idx
  ON lead_automation.processing_events (submission_id, created_at);

CREATE OR REPLACE FUNCTION lead_automation.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_processing_touch_updated_at
  ON lead_automation.lead_processing;

CREATE TRIGGER lead_processing_touch_updated_at
BEFORE UPDATE ON lead_automation.lead_processing
FOR EACH ROW EXECUTE FUNCTION lead_automation.touch_updated_at();

REVOKE ALL ON SCHEMA lead_automation FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA lead_automation FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA lead_automation FROM PUBLIC;
REVOKE ALL ON FUNCTION lead_automation.touch_updated_at() FROM PUBLIC;

SELECT format('GRANT USAGE ON SCHEMA lead_automation TO %I', :'lead_db_user') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE ON lead_automation.lead_processing TO %I', :'lead_db_user') \gexec
SELECT format('GRANT SELECT, INSERT ON lead_automation.processing_events TO %I', :'lead_db_user') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lead_automation TO %I', :'lead_db_user') \gexec
SELECT format('GRANT EXECUTE ON FUNCTION lead_automation.touch_updated_at() TO %I', :'lead_db_user') \gexec

SELECT format('REVOKE DELETE, TRUNCATE ON lead_automation.lead_processing FROM %I', :'lead_db_user') \gexec
SELECT format('REVOKE UPDATE, DELETE, TRUNCATE ON lead_automation.processing_events FROM %I', :'lead_db_user') \gexec
EOSQL
