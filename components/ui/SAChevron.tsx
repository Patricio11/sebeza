import { cn } from "@/lib/utils";

/**
 * SA flag chevron, abstracted.
 *
 * Inspired by  never literal. The SA flag's distinctive Y-shape becomes
 * a structural mark for the landing: a deep-green chevron with the gold-tipped
 * apex of the flag's inner triangle. Used as the landing's signature visual,
 * the search submit button's forward-arrow shape, and a tiny inline mark next
 * to the wordmark.
 *
 * Variants:
 *   - `mark`       small 14×14 wordmark accent
 *   - `inline`     24×24 inline glyph for badges and chips
 *   - `signature`  the oversized hero motif (responsive)
 *   - `divider`    slim banded chevron for section dividers
 */
interface Props {
  variant?: "mark" | "inline" | "signature" | "divider";
  className?: string;
  /** Optional drawing animation on first paint (signature variant). */
  animated?: boolean;
}

export function SAChevron({
  variant = "inline",
  className,
  animated = false,
}: Props) {
  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 14 14"
        aria-hidden="true"
        className={cn("inline-block", className)}
      >
        <path
          d="M0 1 L7 7 L0 13 Z"
          fill="var(--color-sa-green)"
        />
        <path
          d="M2.4 5 L7 7 L2.4 9 L4.6 7 Z"
          fill="var(--color-sa-gold)"
        />
      </svg>
    );
  }

  if (variant === "inline") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cn("inline-block", className)}
      >
        <path
          d="M2 3 L13 12 L2 21 Z"
          fill="var(--color-sa-green)"
        />
        <path
          d="M6 9 L13 12 L6 15 L9 12 Z"
          fill="var(--color-sa-gold)"
        />
      </svg>
    );
  }

  if (variant === "divider") {
    // A horizontal banded chevron strip  used as section separators.
    return (
      <svg
        viewBox="0 0 800 14"
        preserveAspectRatio="none"
        aria-hidden="true"
        className={cn("block w-full", className)}
      >
        <rect width="800" height="3" y="0" fill="var(--color-sa-green)" />
        <rect width="800" height="2" y="5" fill="var(--color-sa-gold)" />
        <rect width="800" height="1" y="9" fill="var(--color-sa-red)" />
      </svg>
    );
  }

  // signature  the hero motif
  return (
    <svg
      viewBox="0 0 600 600"
      aria-hidden="true"
      className={cn("block", className)}
      style={{ "--draw-length": "1600" } as React.CSSProperties}
    >
      <defs>
        <linearGradient id="sa-chev-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-sa-green-soft)" />
          <stop offset="100%" stopColor="var(--color-sa-green-deep)" />
        </linearGradient>
        <linearGradient id="sa-chev-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-sa-gold)" />
          <stop offset="100%" stopColor="var(--color-sa-gold-deep)" />
        </linearGradient>
        <pattern
          id="sa-topo"
          x="0"
          y="0"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="0.5" fill="var(--color-sa-green-soft)" opacity="0.18" />
        </pattern>
      </defs>

      {/* Outer chevron  deep flag-green with gradient */}
      <path
        d="M 60 60 L 360 300 L 60 540 Z"
        fill="url(#sa-chev-green)"
      />

      {/* Inner gold-tipped chevron  abstracted inner triangle */}
      <path
        d="M 180 200 L 360 300 L 180 400 L 260 300 Z"
        fill="url(#sa-chev-gold)"
      />

      {/* Tiny red accent  flag-derived, used at micro scale */}
      <circle cx="372" cy="300" r="4" fill="var(--color-sa-red)" opacity="0.85" />

      {/* Soft topographic dot pattern in the negative space  hints at landscape */}
      <rect x="0" y="0" width="600" height="600" fill="url(#sa-topo)" opacity="0.6" />

      {/* Hairline stroke to give it crispness when overlaid */}
      <path
        d="M 60 60 L 360 300 L 60 540"
        fill="none"
        stroke="var(--color-sa-green-deep)"
        strokeWidth="1.5"
        opacity="0.5"
      />

      {/* Optional one-time draw animation overlay */}
      {animated && (
        <g className="anim-draw">
          <path
            d="M 60 60 L 360 300 L 60 540"
            fill="none"
            stroke="var(--color-sa-gold)"
            strokeWidth="2"
            opacity="0.4"
          />
        </g>
      )}
    </svg>
  );
}
