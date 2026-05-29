import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "lmi-json-public-api",
  title: "LMI JSON public API",
  shortDescription:
    "/api/lmi is a public, no-auth JSON endpoint with the headline LMI + components. Cache 5 min; refresh 1 year. Use it to wire dashboards.",
  category: "exports_reports",
  keywords: [
    "api",
    "json",
    "public",
    "lmi",
    "endpoint",
    "dashboard",
    "no auth",
  ],
  related: [
    "reading-the-lmi",
    "bulk-csv-downloads",
    "policy-brief-as-pdf",
  ],
  surfaceLink: "/gov",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The headline LMI + its three components are published as a
        no-auth JSON endpoint at <code>/api/lmi</code>. This is the
        only Sebenza endpoint without authentication; the data it
        serves is intentionally public &mdash; the platform commits
        to the figure as a public-good labour-market indicator.
      </p>

      <h2>The endpoint</h2>
      <ul>
        <li>
          <strong>URL:</strong> <code>https://sebenzasa.com/api/lmi</code>{" "}
          (or your environment&rsquo;s base URL).
        </li>
        <li>
          <strong>Method:</strong> GET.
        </li>
        <li>
          <strong>Headers:</strong> none required; <code>Accept:
          application/json</code> recommended.
        </li>
        <li>
          <strong>Cache:</strong> 5 minutes at the edge; refresh
          every 5 minutes on your side if you&rsquo;re polling.
        </li>
        <li>
          <strong>Long-cache hint:</strong> the response includes
          a 1-year long-cache identifier you can use for
          hash-stable embedding.
        </li>
      </ul>

      <h2>The response shape</h2>
      <p>
        Three top-level fields:
      </p>
      <ul>
        <li>
          <code>week</code> &mdash; the week ending date the figure
          applies to (ISO yyyy-mm-dd).
        </li>
        <li>
          <code>headline</code> &mdash; the composite LMI as a
          number normalised against the 52-week median (100 =
          median).
        </li>
        <li>
          <code>components</code> &mdash; an object with{" "}
          <code>activity</code>, <code>conversion</code>,{" "}
          <code>persistence</code>, each as numbers on the same
          0100+ scale.
        </li>
      </ul>

      <h2>What the endpoint is for</h2>
      <ul>
        <li>
          Embedding the LMI on a public dashboard or a department
          website.
        </li>
        <li>
          Wiring the figure into your own internal data warehouse
          on a recurring schedule.
        </li>
        <li>
          Programmatic citation in machine-readable policy briefs
          (Open Data initiatives).
        </li>
      </ul>

      <h2>What the endpoint is NOT for</h2>
      <ul>
        <li>
          Personal data, individual seekers, individual employers
          &mdash; none of which it returns.
        </li>
        <li>
          Cell-level analytics (provinces, professions, cohorts)
          &mdash; those need authenticated access via the
          authorised gov workspace.
        </li>
        <li>
          High-volume scraping &mdash; the endpoint is cached + rate-
          limited at the edge. Polling more than once every 5
          minutes wastes bandwidth + can trigger rate-limit
          responses.
        </li>
      </ul>

      <Callout type="info" title="The endpoint is the platform's public commitment">
        <p>
          By exposing the LMI without auth, Sebenza commits to the
          number publicly &mdash; we can&rsquo;t quietly re-baseline
          or revise without journalists, opposition MPs, and
          analysts noticing. That commitment is part of the
          platform&rsquo;s credibility posture as a labour-market
          indicator. If the methodology changes, the endpoint
          publishes the change date in the response; existing
          historical figures stay stable.
        </p>
      </Callout>
    </HelpProse>
  );
}
