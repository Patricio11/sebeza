/**
 * 2026-08-19  read-only "Work & projects" display, shared by the public
 * profile and the employer dossier. Server component: no client JS.
 *
 * Links carry the destination hostname so a viewer sees where they're
 * going, plus `nofollow noopener noreferrer`. Images render as 256px
 * WebP thumbs (lazy) linking to the full-size object  we never fetch
 * or preview a seeker's link server-side (SSRF + page weight).
 */

import { ExternalLink } from "lucide-react";
import type { ProjectView } from "@/lib/profile/projects-read";

export function ProjectsShowcase({
  projects,
  selfDeclaredNote,
}: {
  projects: ProjectView[];
  selfDeclaredNote: string;
}) {
  if (projects.length === 0) return null;

  return (
    <div>
      <ul className="grid gap-5 md:grid-cols-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 transition-colors hover:border-[color:var(--color-brand)]"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-display text-lg leading-snug text-[color:var(--color-ink)]">
                {p.title}
              </h3>
              {p.year && (
                <span className="text-xs tabular text-[color:var(--color-ink-soft)]">
                  {p.year}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink)]">
              {p.contribution}
            </p>

            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-[color:var(--color-brand)] hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                {p.hostname}
              </a>
            )}

            {p.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.images.map((img) =>
                  img.thumbUrl ? (
                    <a
                      key={img.key}
                      href={img.fullUrl ?? img.thumbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.thumbUrl}
                        alt={`${p.title}  work sample`}
                        loading="lazy"
                        className="size-24 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] object-cover transition-opacity hover:opacity-90"
                      />
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        {selfDeclaredNote}
      </p>
    </div>
  );
}
