import { cn } from "@/lib/utils";

interface Props {
  /**
   * Rendered width in px. Height auto-scales to preserve the native
   * 1265×260 aspect ratio. Pick a width that matches the surrounding
   * type size  the wordmark should sit slightly taller than running
   * Hanken body copy, the way Fraunces caps tend to.
   */
  width?: number;
  /**
   * `default` uses the ochre-on-deep-green logo (for paper backgrounds).
   * `light` swaps the deep-green to paper for use over `--color-ink`
   * surfaces (footer). Ochre brand mark stays the same in both.
   */
  tone?: "default" | "light";
  /** Extra classes  positioning, hidden states, etc. */
  className?: string;
  /** Override the alt text. Defaults to "Sebenza". */
  alt?: string;
}

const NATIVE_W = 1265;
const NATIVE_H = 260;

export function SebenzaLogo({
  width = 140,
  tone = "default",
  className,
  alt = "Sebenza",
}: Props) {
  const height = Math.round((width * NATIVE_H) / NATIVE_W);
  const src =
    tone === "light" ? "/sebenza-logo-light.svg" : "/sebenza-logo.svg";
  // Plain <img> on purpose: next/image doesn't optimise SVG by default
  // and adds layout chrome we don't need for a fixed-size vector.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("h-auto select-none", className)}
      draggable={false}
    />
  );
}
