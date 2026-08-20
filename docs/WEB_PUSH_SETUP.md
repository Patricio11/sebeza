# Web Push (VAPID) setup

Phase 35. Ships dark: `feature_flag_web_push` defaults to OFF.

Push tells a seeker on their phone the moment an employer invites them.
Invitations carry a deadline, so hearing late can cost someone the role. That
is the entire justification for interrupting a person's day, and it is why the
default-on set is exactly two kinds and nothing else.

## The three gates

A push only leaves the building when **all three** are open. They are
independent on purpose, and each one can be closed without disturbing the
others:

1. **Platform flag** `feature_flag_web_push` on `/admin/settings`. This is the
   killswitch. Turning it off stops every send without touching anybody's
   subscription, so turning it back on does not re-ask a single person.
2. **Admin configuration**: a `push` integration row on `/admin/integrations`,
   saved and enabled. No env fallback exists; push is admin-configured or off.
3. **The person's own permission**, per device, in their browser. Nothing we do
   server-side can grant this.

## Founder steps, once

```bash
npx web-push generate-vapid-keys
```

This prints a public and a private key. Then, on `/admin/integrations`, open
the **Push (phone notifications)** card and:

1. Paste both keys. Set the contact subject to `mailto:info@sebenzasa.com`
   (push services use it to reach us if our sends misbehave). **Save.**
2. Go to your own account page and turn notifications on for your browser.
   You cannot test push without a registered device, and the test deliberately
   only ever delivers to the admin who pressed the button.
3. Back on `/admin/integrations`, press **Send test notification**. You should
   get one on the device from step 2.
4. Only then **Enable** the channel, and flip `feature_flag_web_push` on.

**Rotating the keys invalidates every subscription that already exists.** Every
user would have to opt in again, silently, without knowing they had stopped
receiving anything. Rotate only if the private key is compromised.

## What a push actually contains

Nothing personal. Title "Sebenza", body = the catalog label for the kind, plus
a relative path to tap. No employer name, no salary, no decline reason, no
candidate name.

A notification renders on a lock screen that anyone holding the phone can read,
including an employer standing next to the person, or a partner, or whoever
picks the phone up. Applying the Redaction Rule to that surface means the push
says only that something happened and where to look. The detail lives behind
authentication, which is where it belongs.

The service worker enforces the other half: a payload path that is not a
same-origin relative path is ignored in favour of `/dashboard`, so a poisoned
payload cannot navigate anyone off-site. See
[lib/push/config.test.ts](../lib/push/config.test.ts).

## Which kinds push by default

Only `vacancy.invite` and `vacancy.invite.followup` (`PUSH_DEFAULT_ON` in
[lib/notifications/catalog.ts](../lib/notifications/catalog.ts)). The test for
membership: is there something the person can do about it, and is there a clock
running? Everything else is opt-in from the preferences panel, where push is a
third column alongside In-app and Email.

Deliberately excluded: `vacancy.invite.expired`. It is written by a 03:45 cron,
it is bad news, and there is nothing left to do about it. Waking someone at
four in the morning to tell them they missed something is not a notification.

## Consent and where we ask

The sign-up form carries a **preference** ("Tell me on my phone when an
employer invites me"), placed below the POPIA consents and outside their box,
because it is not one of them: it authorises no processing. Ticking it records
intent and nothing else. The browser permission is requested later, from the
dashboard, behind a real button the person presses.

That split is deliberate. The browser permission prompt is one-shot per origin:
someone who dismisses it can effectively never be asked again. Firing it during
sign-up, before anyone has seen a single invitation, spends that one chance at
the worst possible moment. So we capture the intent where the other choices
live, and ask the device when the answer means something.

On iPhone and iPad, push only works once the site is added to the home screen.
The opt-in card detects this and says so, rather than failing silently or
claiming the phone is unsupported.

## POPIA

A push endpoint identifies a device, so it is personal data. It is deleted:

- when the user turns push off for that device;
- when the push service returns 404 or 410 (the browser profile is gone);
- after `PUSH_FAILURE_THRESHOLD` consecutive delivery failures;
- by FK cascade when the account is erased.

We store a coarse device label ("Chrome on Android") and never the raw
user-agent string, which is a fingerprinting surface we have no use for.

See RETENTION_POLICY.md and ENCRYPTION_INVENTORY.md. The subscription keys are
the browser's own public key material, useless without our private VAPID key
(which is encrypted at rest in `integration_settings`), so they are stored
as-is.

## Files

| Path | What it is |
|---|---|
| [lib/push/config.ts](../lib/push/config.ts) | Pure: caps, payload building, path safety, device labels |
| [lib/push/send.ts](../lib/push/send.ts) | `server-only`: VAPID resolve, send, prune dead subscriptions |
| [lib/push/actions.ts](../lib/push/actions.ts) | The three Server Actions the browser calls |
| [public/sw.js](../public/sw.js) | `push` + `notificationclick` handlers |
| [components/feature/notifications/PushOptIn.tsx](../components/feature/notifications/PushOptIn.tsx) | The opt-in card |
| `db/migrations/0071_phase35_push_subscriptions.sql` | The table |
