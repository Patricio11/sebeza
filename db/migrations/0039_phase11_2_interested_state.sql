-- Phase 11.2.4  add 'interested' to the learning_state enum.
--
-- The parking-lot state lives between recommended (an in-memory concept,
-- not a row state) and planned/accepted. A seeker who's interested but
-- not yet committed clicks "Save for later" -> we create a learning_items
-- row in state='interested'. They promote it later via the existing
-- accept flow.
--
-- Per D4 the new value lands as an enum addition, not a separate
-- column or table -- keeps the single state-machine invariant intact.
-- Additive change; existing rows untouched.

ALTER TYPE learning_state ADD VALUE IF NOT EXISTS 'interested' BEFORE 'accepted';
