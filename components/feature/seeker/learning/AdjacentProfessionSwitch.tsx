"use client";

/**
 * Phase 11.2.8  client wrapper for the adjacent-profession switch CTA.
 *
 * Server-component AdjacentProfessionCard renders this; the wrapper
 * owns the modal open/close state. Keeping the wrapper one level above
 * the modal means the card stays a server component (cheap render) and
 * only the small interactive surface ships as JS.
 */

import { useState } from "react";
import { SwitchProfessionConfirmModal } from "./SwitchProfessionConfirmModal";

interface Props {
  currentProfession: string;
  nextProfession: string;
}

export function AdjacentProfessionSwitch({
  currentProfession,
  nextProfession,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-brand)] hover:underline"
      >
        Consider this as your profession →
      </button>
      {open && (
        <SwitchProfessionConfirmModal
          currentProfession={currentProfession}
          nextProfession={nextProfession}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
