CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    auth_email VARCHAR(255),
    default_job_weight NUMERIC(3, 1) NOT NULL DEFAULT 1.0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    customer_name VARCHAR(100) NOT NULL DEFAULT '',
    customer_email VARCHAR(255) NOT NULL DEFAULT '',
    customer_notes TEXT NOT NULL DEFAULT '',
    service_id VARCHAR(100),
    agency_id VARCHAR(100),
    agency_name VARCHAR(160) NOT NULL DEFAULT '',
    customer_status VARCHAR(30) NOT NULL DEFAULT 'not_applicable',
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

CREATE TABLE IF NOT EXISTS public.agencies (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    owner_user_id UUID UNIQUE,
    owner_email VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.agencies (id, name, slug)
VALUES ('tundestudio', 'Tunde''s Tailoring Studio', 'tunde-studio')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.people ADD COLUMN IF NOT EXISTS agency_id VARCHAR(100);
UPDATE public.people SET agency_id = 'tundestudio' WHERE agency_id IS NULL;
ALTER TABLE public.people ALTER COLUMN agency_id SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE public.people ADD CONSTRAINT people_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS people_agency_active_name_idx ON public.people(agency_id, active, name);

CREATE TABLE IF NOT EXISTS public.marketplace_services (
    id VARCHAR(100) PRIMARY KEY,
    agency_id VARCHAR(100) NOT NULL,
    agency_name VARCHAR(160) NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    turnaround VARCHAR(80) NOT NULL,
    initials VARCHAR(4) NOT NULL DEFAULT 'BP',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    ALTER TABLE public.marketplace_services ADD CONSTRAINT marketplace_services_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_agency_profiles (
    agency_id VARCHAR(100) PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
    tagline VARCHAR(180) NOT NULL DEFAULT '',
    story TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    ALTER TABLE public.marketplace_agency_profiles ADD CONSTRAINT marketplace_agency_profiles_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id VARCHAR(100) NOT NULL REFERENCES public.marketplace_agency_profiles(agency_id),
    title VARCHAR(120) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS marketplace_portfolio_agency_created_idx
    ON public.marketplace_portfolio(agency_id, created_at DESC) WHERE active = TRUE;

INSERT INTO public.marketplace_agency_profiles (agency_id, tagline, story)
VALUES (
    'tundestudio',
    'Thoughtful tailoring, made with care',
    'We work with each customer to understand the fit, finish, and details they need, then coordinate our team from first measurement to final handoff.'
)
ON CONFLICT (agency_id) DO NOTHING;

INSERT INTO public.marketplace_services (id, agency_id, agency_name, category, title, description, price_cents, turnaround, initials)
VALUES
    ('tailored-outfit', 'tundestudio', 'Tunde''s Tailoring Studio', 'Fashion & Tailoring', 'Custom occasion outfit', 'A made-to-measure outfit, finished and fitted by the studio team.', 20000, '5–7 days', 'TS'),
    ('garment-alterations', 'tundestudio', 'Tunde''s Tailoring Studio', 'Fashion & Tailoring', 'Garment alterations', 'A careful fit adjustment with professional finishing.', 6500, '2–3 days', 'TS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('agency-portfolio', 'agency-portfolio', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_id VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS agency_id VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS agency_name VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_status VARCHAR(30) NOT NULL DEFAULT 'not_applicable';
DO $$ BEGIN
    ALTER TABLE jobs ADD CONSTRAINT valid_customer_status
      CHECK (customer_status IN ('not_applicable', 'awaiting_payment', 'paid', 'in_progress', 'completed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE people ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS auth_email VARCHAR(255);
UPDATE people SET auth_email = email WHERE auth_email IS NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paypal_capture_id VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_captured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paypal_sender_batch_id VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paypal_claimed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payout_request JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS review_snapshot JSONB;
UPDATE public.jobs SET agency_id = 'tundestudio' WHERE agency_id IS NULL;
ALTER TABLE public.jobs ALTER COLUMN agency_id SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS jobs_agency_created_idx ON public.jobs(agency_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_paypal_sender_batch_id_unique ON jobs(paypal_sender_batch_id) WHERE paypal_sender_batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS people_auth_email_unique ON people(lower(auth_email)) WHERE auth_email IS NOT NULL;

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

ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS agency_id VARCHAR(100);
UPDATE public.payouts AS p SET agency_id = j.agency_id FROM public.jobs AS j WHERE p.job_id = j.id AND p.agency_id IS NULL;
UPDATE public.payouts SET agency_id = 'tundestudio' WHERE agency_id IS NULL;
ALTER TABLE public.payouts ALTER COLUMN agency_id SET NOT NULL;
DO $$ BEGIN
    ALTER TABLE public.payouts ADD CONSTRAINT payouts_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payouts_agency_created_idx ON public.payouts(agency_id, created_at DESC);

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

-- Crew members submit time claims. Only the boss may review them
CREATE TABLE IF NOT EXISTS work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id),
    work_date DATE NOT NULL,
    task VARCHAR(160) NOT NULL,
    hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    details TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    review_note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    CONSTRAINT valid_work_log_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS work_logs_person_submitted_idx ON work_logs(person_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS work_logs_status_submitted_idx ON work_logs(status, submitted_at DESC);

ALTER TABLE payouts ALTER COLUMN person_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS payouts_job_id_idx ON payouts(job_id);
CREATE INDEX IF NOT EXISTS job_events_job_id_idx ON job_events(job_id, created_at);


ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_agency_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_portfolio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agencies, public.people, public.jobs, public.payouts, public.job_events, public.work_logs, public.marketplace_services, public.marketplace_agency_profiles, public.marketplace_portfolio FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agencies, public.people, public.jobs, public.payouts, public.job_events, public.work_logs, public.marketplace_services, public.marketplace_agency_profiles, public.marketplace_portfolio TO service_role;
GRANT DELETE ON TABLE public.marketplace_portfolio TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
