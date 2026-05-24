/**
 * Small password-strength meter used by the sign-up forms.
 *
 * Heuristic score 0-4 driven by length + character-class diversity
 * (lowercase, uppercase, digit, symbol). NOT a substitute for a real
 * zxcvbn check  it's a hint to the user that "yourname" + 4 digits
 * is weak, and that "n%a3-Tu7$reLM" is strong. Scrypt password
 * hashing (Better Auth) is the actual brute-force defence.
 */

import { cn } from "@/lib/utils";

export interface PasswordStrength {
  /** 0 = empty, 1 = very weak, 2 = weak, 3 = good, 4 = strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

export function scorePassword(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "" };
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;

  let score: PasswordStrength["score"] = 1;
  if (pw.length < 10) score = 1;
  else if (pw.length < 12) score = classes >= 3 ? 2 : 1;
  else if (pw.length < 16) score = classes >= 3 ? 3 : 2;
  else score = classes >= 3 ? 4 : 3;

  return {
    score,
    label: ["", "Very weak", "Weak", "Good", "Strong"][score]!,
  };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = scorePassword(password);
  if (!password) return null;

  const segments = [1, 2, 3, 4] as const;
  return (
    <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
      <div
        className="flex flex-1 items-center gap-1"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-label={`Password strength: ${label}`}
      >
        {segments.map((s) => (
          <span
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              s > score
                ? "bg-[color:var(--color-hairline)]"
                : score === 1
                  ? "bg-[color:var(--color-danger)]"
                  : score === 2
                    ? "bg-[color:var(--color-accent)]"
                    : score === 3
                      ? "bg-[color:var(--color-brand)]"
                      : "bg-[color:var(--color-brand-strong)]",
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "min-w-[4.5rem] text-right text-[0.62rem] uppercase tracking-[0.18em]",
          score <= 1
            ? "text-[color:var(--color-danger)]"
            : score === 2
              ? "text-[color:var(--color-accent)]"
              : "text-[color:var(--color-brand-strong)]",
        )}
      >
        {label}
      </span>
    </div>
  );
}
