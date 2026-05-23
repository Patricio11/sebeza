"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { resendVerificationEmail } from "@/lib/auth/actions";

export function ResendVerificationButton({
  email,
  label,
}: {
  email: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  return (
    <Button
      variant="primary"
      size="md"
      disabled={pending || sent}
      onClick={() => {
        startTransition(async () => {
          await resendVerificationEmail(email);
          setSent(true);
        });
      }}
    >
      {sent ? "Sent  check your inbox" : pending ? "Sending…" : label}
    </Button>
  );
}
