CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    default_job_weight NUMERIC(3, 1) NOT NULL DEFAULT 1.0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    raw_story TEXT NOT NULL DEFAULT '',
    total_customer_payment_cents INTEGER NOT NULL CHECK (total_customer_payment_cents >= 0),
    material_costs_cents INTEGER NOT NULL DEFAULT 0 CHECK (material_costs_cents >= 0),
    boss_share_cents INTEGER NOT NULL DEFAULT 0 CHECK (boss_share_cents >= 0),
    crew_pile_cents INTEGER NOT NULL DEFAULT 0 CHECK (crew_pile_cents >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    paypal_order_id VARCHAR(100) UNIQUE,
    paypal_capture_id VARCHAR(100),
    payment_captured BOOLEAN NOT NULL DEFAULT FALSE,
    paypal_sender_batch_id VARCHAR(100) UNIQUE,
    paypal_claimed_at TIMESTAMPTZ,
    payout_request JSONB,
    review_snapshot JSONB,
    paypal_payout_batch_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    CONSTRAINT valid_status CHECK (status IN ('draft', 'reviewed', 'approved', 'sent'))
);

ALTER TABLE people ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_captured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paypal_sender_batch_id VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paypal_claimed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payout_request JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS review_snapshot JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_paypal_sender_batch_id_unique ON jobs(paypal_sender_batch_id) WHERE paypal_sender_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payouts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    person_id UUID REFERENCES people(id),
    recipient_email VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    hours NUMERIC(7, 2) NOT NULL DEFAULT 0,
    weight NUMERIC(3, 1) NOT NULL DEFAULT 1.0,
    points NUMERIC(9, 4) NOT NULL DEFAULT 0,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    reason TEXT,
    thank_you_note TEXT,
    paypal_payout_batch_id VARCHAR(100) NOT NULL,
    paypal_payout_item_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (paypal_payout_batch_id, person_id),
    CONSTRAINT valid_payout_status CHECK (status IN ('pending', 'success', 'failed'))
);

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS paypal_payout_batch_id VARCHAR(100);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS paypal_payout_item_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS payouts_batch_person_unique ON payouts(paypal_payout_batch_id, person_id) WHERE paypal_payout_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS job_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    event VARCHAR(80) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payouts ALTER COLUMN person_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS payouts_job_id_idx ON payouts(job_id);
CREATE INDEX IF NOT EXISTS job_events_job_id_idx ON job_events(job_id, created_at);

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.people, public.jobs, public.payouts, public.job_events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
