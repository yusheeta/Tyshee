-- Loadline schema v1: budget tree, balances, reservations, double-entry ledger,
-- idempotency keys and usage events. Postgres 16.
--
-- Money is integer micro-credits (bigint). Every guard that can live in the
-- database lives here, so a bug in Go fails a transaction instead of
-- corrupting a balance. See docs/invariants.md for I1-I9.

-- Roles ------------------------------------------------------------------
-- loadline_app:    the API. Subject to row-level security (I9).
-- loadline_system: the worker and admin tools. Crosses tenants (sweeper, auditor).
-- Both are NOLOGIN; deployments grant them to login users, tests use SET ROLE.
DO $$
BEGIN
  BEGIN
    CREATE ROLE loadline_app NOLOGIN;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE ROLE loadline_system NOLOGIN BYPASSRLS;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Tenants and keys -------------------------------------------------------
CREATE TABLE tenants (
  id         bigserial   PRIMARY KEY,
  name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
  id          bigserial   PRIMARY KEY,
  tenant_id   bigint      NOT NULL REFERENCES tenants(id),
  prefix      text        NOT NULL UNIQUE,
  secret_hash bytea       NOT NULL,
  scopes      text[]      NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- Budget tree ------------------------------------------------------------
CREATE TYPE budget_period AS ENUM ('daily', 'monthly', 'none');

CREATE TABLE budget_nodes (
  id               bigserial     PRIMARY KEY,
  tenant_id        bigint        NOT NULL REFERENCES tenants(id),
  parent_id        bigint,
  name             text          NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  -- Path from the root to this node, inclusive: ancestor_ids[depth] = id.
  ancestor_ids     bigint[]      NOT NULL,
  depth            smallint      NOT NULL CHECK (depth BETWEEN 1 AND 4),
  period           budget_period NOT NULL,
  limit_micros     bigint        NOT NULL CHECK (limit_micros >= 0),
  overdraft_micros bigint        NOT NULL DEFAULT 0 CHECK (overdraft_micros >= 0),
  created_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  -- A parent must belong to the same tenant.
  FOREIGN KEY (parent_id, tenant_id) REFERENCES budget_nodes (id, tenant_id),
  CHECK ((parent_id IS NULL) = (depth = 1)),
  CHECK (cardinality(ancestor_ids) = depth AND ancestor_ids[depth] = id)
);
CREATE INDEX budget_nodes_tenant ON budget_nodes (tenant_id);
CREATE UNIQUE INDEX budget_nodes_sibling_name
  ON budget_nodes (tenant_id, coalesce(parent_id, 0), name);

-- Ledger accounts --------------------------------------------------------
-- Each node has available, held and consumed accounts per period.
-- Each tenant has one external account: the source of grants.
CREATE TYPE account_kind AS ENUM ('available', 'held', 'consumed', 'external');

CREATE TABLE ledger_accounts (
  id           bigserial    PRIMARY KEY,
  tenant_id    bigint       NOT NULL REFERENCES tenants(id),
  node_id      bigint,
  period_start timestamptz,
  kind         account_kind NOT NULL,
  FOREIGN KEY (node_id, tenant_id) REFERENCES budget_nodes (id, tenant_id),
  CHECK ((kind = 'external') = (node_id IS NULL)),
  CHECK ((node_id IS NULL) = (period_start IS NULL)),
  UNIQUE NULLS NOT DISTINCT (tenant_id, node_id, period_start, kind)
);

-- Balances: the hot rows ------------------------------------------------
-- A projection of the journal, written in the same transaction as the
-- entries. The auditor proves the two agree (I2, I3).
CREATE TABLE node_balances (
  tenant_id            bigint      NOT NULL,
  node_id              bigint      NOT NULL,
  period_start         timestamptz NOT NULL,
  allocated            bigint      NOT NULL CHECK (allocated >= 0),
  overdraft            bigint      NOT NULL CHECK (overdraft >= 0),
  held                 bigint      NOT NULL DEFAULT 0 CHECK (held >= 0),
  consumed             bigint      NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  -- Usage charged past allocated + overdraft (settles above the hold, late
  -- settles). Recorded, never refused: the money was already spent upstream.
  overrun              bigint      NOT NULL DEFAULT 0 CHECK (overrun >= 0),
  frozen               boolean     NOT NULL DEFAULT false,
  available_account_id bigint      NOT NULL REFERENCES ledger_accounts(id),
  held_account_id      bigint      NOT NULL REFERENCES ledger_accounts(id),
  consumed_account_id  bigint      NOT NULL REFERENCES ledger_accounts(id),
  version              bigint      NOT NULL DEFAULT 0,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, period_start),
  FOREIGN KEY (node_id, tenant_id) REFERENCES budget_nodes (id, tenant_id),
  CHECK (overrun <= consumed),
  -- I1 in the database: admitted money never exceeds limit + overdraft.
  CHECK (held + consumed - overrun <= allocated + overdraft),
  CHECK (frozen OR overrun = 0)
);

-- Reservations -----------------------------------------------------------
CREATE TYPE reservation_state AS ENUM ('HELD', 'SETTLED', 'RELEASED', 'EXPIRED');

CREATE TABLE reservations (
  id             bigserial         PRIMARY KEY,
  tenant_id      bigint            NOT NULL,
  leaf_node_id   bigint            NOT NULL,
  amount         bigint            NOT NULL CHECK (amount > 0),
  state          reservation_state NOT NULL DEFAULT 'HELD',
  expires_at     timestamptz       NOT NULL,
  max_expires_at timestamptz       NOT NULL,
  settled_amount bigint            CHECK (settled_amount >= 0),
  trace_id       text,
  created_at     timestamptz       NOT NULL DEFAULT now(),
  updated_at     timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (leaf_node_id, tenant_id) REFERENCES budget_nodes (id, tenant_id),
  CHECK ((state = 'SETTLED') = (settled_amount IS NOT NULL)),
  CHECK (expires_at <= max_expires_at)
);
CREATE INDEX reservations_expiring ON reservations (expires_at) WHERE state = 'HELD';
CREATE INDEX reservations_tenant ON reservations (tenant_id, created_at DESC);

-- One row per level on the path. Records the period each hold landed in,
-- so a settle after a period rollover still adjusts the right row.
CREATE TABLE reservation_holds (
  reservation_id bigint      NOT NULL,
  tenant_id      bigint      NOT NULL,
  node_id        bigint      NOT NULL,
  period_start   timestamptz NOT NULL,
  amount         bigint      NOT NULL CHECK (amount > 0),
  PRIMARY KEY (reservation_id, node_id),
  FOREIGN KEY (reservation_id, tenant_id) REFERENCES reservations (id, tenant_id),
  FOREIGN KEY (node_id, period_start) REFERENCES node_balances (node_id, period_start)
);
CREATE INDEX reservation_holds_node ON reservation_holds (node_id, period_start);

-- A settle that arrives after the sweeper expired the hold. The reservation
-- stays EXPIRED (I5); the charge is recorded here, at most once.
CREATE TABLE late_settles (
  reservation_id bigint      PRIMARY KEY,
  tenant_id      bigint      NOT NULL,
  amount         bigint      NOT NULL CHECK (amount >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (reservation_id, tenant_id) REFERENCES reservations (id, tenant_id)
);

-- Journal ----------------------------------------------------------------
CREATE TYPE ledger_txn_kind AS ENUM
  ('grant', 'reserve', 'settle', 'release', 'expire', 'late_settle', 'usage');

CREATE TABLE ledger_transactions (
  id             bigserial       PRIMARY KEY,
  tenant_id      bigint          NOT NULL REFERENCES tenants(id),
  kind           ledger_txn_kind NOT NULL,
  reservation_id bigint,
  created_at     timestamptz     NOT NULL DEFAULT now(),
  FOREIGN KEY (reservation_id, tenant_id) REFERENCES reservations (id, tenant_id)
);
CREATE INDEX ledger_transactions_reservation ON ledger_transactions (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE TABLE ledger_entries (
  id             bigserial PRIMARY KEY,
  transaction_id bigint    NOT NULL REFERENCES ledger_transactions(id),
  tenant_id      bigint    NOT NULL,
  account_id     bigint    NOT NULL REFERENCES ledger_accounts(id),
  amount_micros  bigint    NOT NULL CHECK (amount_micros <> 0)
);
CREATE INDEX ledger_entries_txn ON ledger_entries (transaction_id);
CREATE INDEX ledger_entries_account ON ledger_entries (account_id);

-- Idempotency and usage --------------------------------------------------
-- The key row is inserted at the start of the transaction that performs
-- the effect and completed at its end, so key and effect commit together
-- (I4). A concurrent duplicate blocks on the primary key, then replays.
CREATE TABLE idempotency_keys (
  tenant_id     bigint      NOT NULL REFERENCES tenants(id),
  key           text        NOT NULL CHECK (length(key) BETWEEN 1 AND 255),
  endpoint      text        NOT NULL,
  request_hash  bytea       NOT NULL,
  response_code int,
  response_body jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);
CREATE INDEX idempotency_keys_created ON idempotency_keys (created_at);

CREATE TABLE usage_events (
  tenant_id    bigint      NOT NULL REFERENCES tenants(id),
  event_id     text        NOT NULL CHECK (length(event_id) BETWEEN 1 AND 255),
  leaf_node_id bigint      NOT NULL,
  amount       bigint      NOT NULL CHECK (amount >= 0),
  occurred_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (leaf_node_id, tenant_id) REFERENCES budget_nodes (id, tenant_id)
);

-- Guards: append-only history and final terminal states ---------------
CREATE FUNCTION loadline_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: the table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER ledger_transactions_append_only
  BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION loadline_forbid_change();
CREATE TRIGGER ledger_transactions_no_truncate
  BEFORE TRUNCATE ON ledger_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION loadline_forbid_change();
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION loadline_forbid_change();
CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION loadline_forbid_change();
CREATE TRIGGER reservation_holds_append_only
  BEFORE UPDATE OR DELETE ON reservation_holds
  FOR EACH ROW EXECUTE FUNCTION loadline_forbid_change();
CREATE TRIGGER late_settles_append_only
  BEFORE UPDATE OR DELETE ON late_settles
  FOR EACH ROW EXECUTE FUNCTION loadline_forbid_change();

-- I2: every journal transaction sums to zero, checked at commit.
CREATE FUNCTION loadline_check_txn_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total numeric;
BEGIN
  SELECT sum(amount_micros) INTO total
    FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF total <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced: entries sum to %',
      NEW.transaction_id, total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION loadline_check_txn_balanced();

-- I5: only HELD may change; identity columns never change.
CREATE FUNCTION loadline_guard_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state <> 'HELD' THEN
    RAISE EXCEPTION 'reservation % is % and final', OLD.id, OLD.state
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id <> OLD.id OR NEW.tenant_id <> OLD.tenant_id
     OR NEW.leaf_node_id <> OLD.leaf_node_id OR NEW.amount <> OLD.amount
     OR NEW.max_expires_at <> OLD.max_expires_at OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'reservation % identity columns are immutable', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER reservations_state_guard
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION loadline_guard_reservation();
CREATE TRIGGER reservations_no_delete
  BEFORE DELETE ON reservations
  FOR EACH ROW EXECUTE FUNCTION loadline_forbid_change();

-- I9: row-level security -------------------------------------------------
-- The API sets app.tenant_id with set_config(..., true) at the start of
-- every transaction. If it is unset, current_setting raises: fail closed.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['api_keys', 'budget_nodes', 'ledger_accounts', 'node_balances',
                           'reservations', 'reservation_holds', 'late_settles',
                           'ledger_transactions', 'ledger_entries', 'idempotency_keys',
                           'usage_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO loadline_app
         USING (tenant_id = current_setting(''app.tenant_id'')::bigint)
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::bigint)', t);
  END LOOP;
END $$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants TO loadline_app
  USING (id = current_setting('app.tenant_id')::bigint);

-- Grants -----------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO loadline_app, loadline_system;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO loadline_app, loadline_system;
-- History tables: no UPDATE for anyone (the triggers back this up).
REVOKE UPDATE ON ledger_transactions, ledger_entries, reservation_holds, late_settles
  FROM loadline_app, loadline_system;
-- Tenants and keys are created by the system role only.
REVOKE INSERT, UPDATE ON tenants FROM loadline_app;
-- Old idempotency keys are pruned by the worker.
GRANT DELETE ON idempotency_keys TO loadline_system;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO loadline_app, loadline_system;
