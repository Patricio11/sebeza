-- Expand profession taxonomy with spa/wellness + fitness/sport sectors.
-- Flagged 2026-05-26: the original "Beauty + wellness" only covered
-- beauty-therapist + hairstylist + barber + nail-technician  the
-- spa side (massage / spa / aesthetician / makeup artist) + the
-- fitness adjacent (personal trainer / yoga / pilates) were missing.
--
-- Eight new entries across two sectors:
--
--   Beauty + wellness (spa additions):
--     - massage-therapist   (very common SA freelance role)
--     - spa-therapist       (umbrella spa role, distinct from beauty)
--     - aesthetician        (skincare-focused, beauty-adjacent)
--     - makeup-artist       (event / film / wedding)
--
--   Fitness + sport (new sector):
--     - personal-trainer    (gym + freelance PT)
--     - fitness-instructor  (group classes, gym-employed)
--     - yoga-instructor     (studio + freelance)
--     - pilates-instructor  (studio + freelance)
--
-- Note: "sports-coach" stays in the Education sector  it's
-- youth/school context coaching, distinct from commercial fitness.
--
-- ON CONFLICT DO NOTHING preserves admin-added rows. Re-runs no-op.

INSERT INTO professions (slug, label) VALUES
  -- Spa + wellness
  ('massage-therapist',  'Massage Therapist'),
  ('spa-therapist',      'Spa Therapist'),
  ('aesthetician',       'Aesthetician'),
  ('makeup-artist',      'Makeup Artist'),
  -- Fitness + sport
  ('personal-trainer',   'Personal Trainer'),
  ('fitness-instructor', 'Fitness Instructor'),
  ('yoga-instructor',    'Yoga Instructor'),
  ('pilates-instructor', 'Pilates Instructor')
ON CONFLICT (slug) DO NOTHING;
