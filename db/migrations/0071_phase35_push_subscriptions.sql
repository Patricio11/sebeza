-- Phase 35: Web Push (VAPID) for seekers.
--
-- One row per browser-and-device a user has opted in on. The endpoint
-- URL is issued by the browser vendor's push service and is a stable
-- identifier for that installation, so it is personal data under POPIA:
-- it is deleted when the user unsubscribes, when the push service tells
-- us it is gone (404/410), and by the cascade when the account is
-- erased.
--
-- The two keys are the browser's own public key material for payload
-- encryption. They are useless without the private VAPID key (which
-- lives encrypted in integration_settings, never here) and they cannot
-- be used to read anything, so they are stored as-is rather than
-- encrypted at rest.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             text PRIMARY KEY,
  user_id        text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  endpoint       text NOT NULL,
  p256dh         text NOT NULL,
  auth           text NOT NULL,
  -- Coarse device label for the "your devices" list, e.g. "Chrome on
  -- Android". Never the raw user-agent string: that is a fingerprinting
  -- surface we have no use for.
  device_label   text,
  created_at     timestamp NOT NULL DEFAULT now(),
  last_success_at timestamp,
  -- Consecutive delivery failures. Pruned at the threshold so a dead
  -- installation cannot accumulate forever.
  failure_count  integer NOT NULL DEFAULT 0
);

-- The endpoint IS the identity of a subscription: re-subscribing the
-- same browser must update the existing row, never fork a duplicate
-- that would deliver the same notification twice.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_uq
  ON push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);
