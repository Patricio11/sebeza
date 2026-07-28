/**
 * Phase 33 (33.6)  auth route-group layout.
 *
 * Exists ONLY to carry the noindex meta for every auth surface
 * (sign-in, sign-up, 2FA, email verification, password reset) in one
 * place  robots.txt prevents crawling, but a leaked/linked URL could
 * still be indexed by reference without this. Renders no chrome; each
 * auth page keeps its own full-page composition.
 */

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
