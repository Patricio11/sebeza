import Image from "next/image";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/mock/types";

/**
 * Profile avatar with sophisticated initials fallback.
 *
 * Renders an actual photo when `photoUrl` is set; otherwise paints a
 * deterministic SA-palette block with Fraunces initials. Optional verification
 * ring (green for verified, gold for pending, none otherwise) sits around the
 * avatar in a way that's honest and never lies — Verification-Honesty Rule.
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface Props {
  /** Name or display name — used to seed the initials + palette. */
  name: string;
  /** Optional photo URL. When set, image takes precedence over initials. */
  photoUrl?: string | null;
  /** Verification state of the profile — drives the ring colour, honestly. */
  verification?: VerificationStatus;
  size?: AvatarSize;
  /** Whether to render the verification ring at all. */
  showRing?: boolean;
  className?: string;
}

export function Avatar({
  name,
  photoUrl,
  verification,
  size = "md",
  showRing = true,
  className,
}: Props) {
  const initials = getInitials(name);
  const palette = paletteForName(name);
  const dims = SIZE_PX[size];
  const fontSize = FONT_PX[size];

  const ringTone =
    showRing && verification === "verified"
      ? "ring-2 ring-offset-2 ring-[color:var(--color-brand)] ring-offset-[color:var(--color-paper)]"
      : showRing && verification === "pending"
        ? "ring-2 ring-offset-2 ring-[color:var(--color-accent)] ring-offset-[color:var(--color-paper)]"
        : "";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        ringTone,
        className,
      )}
      style={{ width: dims, height: dims }}
      role="img"
      aria-label={photoUrl ? `${name} (photo)` : `${name} (initials)`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={dims}
          height={dims}
          className="size-full object-cover"
          unoptimized
        />
      ) : (
        <InitialsBlock
          initials={initials}
          palette={palette}
          fontSize={fontSize}
          dims={dims}
        />
      )}
    </span>
  );
}

function InitialsBlock({
  initials,
  palette,
  fontSize,
  dims,
}: {
  initials: string;
  palette: Palette;
  fontSize: number;
  dims: number;
}) {
  // Slightly off-center initials + a subtle Y-chevron mark in the corner give
  // the fallback character without it screaming "generated avatar".
  return (
    <svg
      width={dims}
      height={dims}
      viewBox={`0 0 ${dims} ${dims}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`grad-${palette.id}`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <rect width={dims} height={dims} fill={`url(#grad-${palette.id})`} />
      {/* Faint chevron in the lower-right — Sebenza's signature mark on every
          generated avatar, sits at ~6% opacity so it's a watermark, not a logo. */}
      <path
        d={`M ${dims * 0.55} ${dims * 0.7} L ${dims * 0.92} ${dims * 0.85} L ${dims * 0.55} ${dims}`}
        fill={palette.markColor}
        opacity={0.18}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontWeight={500}
        fontSize={fontSize}
        fill={palette.fg}
        letterSpacing="-0.02em"
      >
        {initials}
      </text>
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

interface Palette {
  id: string;
  from: string;
  to: string;
  fg: string;
  markColor: string;
}

// Six deterministic palettes drawing from the SA flag palette. Each name hashes
// to one — same person gets the same avatar across renders.
const PALETTES: Palette[] = [
  {
    id: "green",
    from: "#006b3c",
    to: "#003d1f",
    fg: "#fbf8f0",
    markColor: "#f5a623",
  },
  {
    id: "gold",
    from: "#f5a623",
    to: "#c98214",
    fg: "#14110d",
    markColor: "#003d1f",
  },
  {
    id: "charcoal",
    from: "#2a2622",
    to: "#14110d",
    fg: "#f5a623",
    markColor: "#006b3c",
  },
  {
    id: "stone",
    from: "#5a5249",
    to: "#3a342d",
    fg: "#fbf8f0",
    markColor: "#f5a623",
  },
  {
    id: "cream-ink",
    from: "#fbf8f0",
    to: "#e1d8c5",
    fg: "#14110d",
    markColor: "#006b3c",
  },
  {
    id: "tealgreen",
    from: "#0a8c50",
    to: "#006b3c",
    fg: "#fbf8f0",
    markColor: "#f5a623",
  },
];

function paletteForName(name: string): Palette {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTES[h % PALETTES.length]!;
}

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 72,
  xl: 112,
  "2xl": 168,
};

const FONT_PX: Record<AvatarSize, number> = {
  xs: 11,
  sm: 14,
  md: 19,
  lg: 28,
  xl: 44,
  "2xl": 64,
};
