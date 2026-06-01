"use client";

/**
 * Phase 13.3  /admin/llm client manager.
 *
 * Lists the four supported providers as cards. Each card surfaces
 * configure / activate / test / rotate / deactivate actions
 * depending on current state. Cross-border providers (openai,
 * anthropic) gate the configure flow behind an explicit POPIA s.72
 * acknowledgement checkbox.
 *
 * Civic-Editorial typography: ordinal eyebrow, no card-grid SaaS
 * polish; Fraunces display + Hanken Grotesk body inherited from the
 * shell.
 */

import { useState, useTransition } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Play,
  Pause,
  Loader2,
} from "lucide-react";
import {
  configureLlmProvider,
  activateLlmProvider,
  deactivateAllLlmProviders,
  testLlmProvider,
  rotateLlmCredentials,
} from "@/lib/admin/llm-actions";

export type LlmProviderView = {
  id: string;
  displayName: string;
  active: boolean;
  hasCredentials: boolean;
  monthlyBudgetZar: number;
  configuredAt: string | null;
  lastUsedAt: string | null;
  totalCalls: number;
  totalTokens: number;
  totalSpendZar: number;
  s72AcknowledgedAt: string | null;
};

type Props = {
  providers: LlmProviderView[];
  killSwitchOn: boolean;
};

const CROSS_BORDER_PROVIDERS = new Set(["openai", "anthropic"]);
const PROVIDER_KIND_HINT: Record<string, string> = {
  openai: "Cross-border (US)  POPIA s.72 acknowledgement required",
  anthropic: "Cross-border (US)  POPIA s.72 acknowledgement required",
  mistral: "EU (POPIA-equivalent regime)  no s.72 acknowledgement",
  self_hosted: "Self-hosted in af-south-1  POPIA-clean recommended path",
};

export function LlmProvidersManager({ providers, killSwitchOn }: Props) {
  const [globalStatus, setGlobalStatus] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pendingTest, startTestTransition] = useTransition();
  const [pendingDeactivate, startDeactivateTransition] = useTransition();

  function handleTest() {
    setGlobalError(null);
    setGlobalStatus(null);
    startTestTransition(async () => {
      const res = await testLlmProvider();
      if (res.ok) {
        setGlobalStatus(res.message ?? "Probe call returned ok.");
      } else {
        setGlobalError(res.message);
      }
    });
  }

  function handleDeactivateAll() {
    setGlobalError(null);
    setGlobalStatus(null);
    startDeactivateTransition(async () => {
      const res = await deactivateAllLlmProviders();
      if (res.ok) {
        setGlobalStatus(res.message ?? "All providers deactivated.");
      } else {
        setGlobalError(res.message);
      }
    });
  }

  const anyActive = providers.some((p) => p.active);

  return (
    <div className="space-y-6">
      {/* Global controls. Test runs against whichever is active. */}
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={!anyActive || pendingTest}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingTest ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3" aria-hidden />
          )}
          Test active provider
        </button>
        <button
          type="button"
          onClick={handleDeactivateAll}
          disabled={!anyActive || pendingDeactivate}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/60 bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-warning)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingDeactivate ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Pause className="size-3" aria-hidden />
          )}
          Deactivate all (pause)
        </button>
        {!killSwitchOn && (
          <p className="text-xs text-[color:var(--color-ink-soft)]">
            Kill-switch is OFF  test still works (probes only), but
            /admin/curriculum dispatches are refused.
          </p>
        )}
      </div>

      {globalStatus && (
        <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-positive)]/40 bg-[color:var(--color-positive)]/10 px-3 py-2 text-xs text-[color:var(--color-ink)]">
          {globalStatus}
        </p>
      )}
      {globalError && (
        <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-3 py-2 text-xs text-[color:var(--color-ink)]">
          {globalError}
        </p>
      )}

      <ul className="grid gap-4 lg:grid-cols-2">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </ul>
    </div>
  );
}

function ProviderCard({ provider }: { provider: LlmProviderView }) {
  const [open, setOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const spendPct =
    provider.monthlyBudgetZar > 0
      ? Math.min(
          100,
          Math.round((provider.totalSpendZar / provider.monthlyBudgetZar) * 100),
        )
      : 0;
  const overBudget =
    provider.monthlyBudgetZar > 0 &&
    provider.totalSpendZar >= provider.monthlyBudgetZar;
  const requiresS72 = CROSS_BORDER_PROVIDERS.has(provider.id);

  function handleActivate() {
    setError(null);
    startTransition(async () => {
      const res = await activateLlmProvider({
        providerId: provider.id as "openai" | "anthropic" | "mistral" | "self_hosted",
      });
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <li
      className={`rounded-[var(--radius-md)] border bg-[color:var(--color-surface)] p-5 ${
        provider.active
          ? "border-[color:var(--color-ink)]"
          : "border-[color:var(--color-hairline)]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg">{provider.displayName}</p>
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            {PROVIDER_KIND_HINT[provider.id] ?? ""}
          </p>
        </div>
        <StatusChip provider={provider} />
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[color:var(--color-ink-soft)]">
        <div>
          <dt className="uppercase tracking-[0.12em]">Configured</dt>
          <dd className="text-[color:var(--color-ink)]">
            {provider.configuredAt
              ? new Date(provider.configuredAt).toISOString().slice(0, 10)
              : ""}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em]">Last used</dt>
          <dd className="text-[color:var(--color-ink)]">
            {provider.lastUsedAt
              ? new Date(provider.lastUsedAt).toISOString().slice(0, 10)
              : ""}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em]">Calls</dt>
          <dd className="text-[color:var(--color-ink)] tabular-nums">
            {provider.totalCalls.toLocaleString("en-ZA")}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em]">Tokens</dt>
          <dd className="text-[color:var(--color-ink)] tabular-nums">
            {provider.totalTokens.toLocaleString("en-ZA")}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="uppercase tracking-[0.12em]">Monthly spend</dt>
          <dd className="text-[color:var(--color-ink)]">
            <span className="tabular-nums">
              R {provider.totalSpendZar.toFixed(2)}
            </span>
            {provider.monthlyBudgetZar > 0 && (
              <>
                {" "}
                <span className="text-[color:var(--color-ink-soft)]">
                  / R {provider.monthlyBudgetZar.toLocaleString("en-ZA")} budget
                </span>
              </>
            )}
            {provider.monthlyBudgetZar > 0 && (
              <div
                className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                aria-hidden
              >
                <div
                  className={`h-full ${
                    overBudget
                      ? "bg-[color:var(--color-warning)]"
                      : spendPct >= 80
                        ? "bg-[color:var(--color-warning)]/70"
                        : "bg-[color:var(--color-ink)]"
                  }`}
                  style={{ width: `${spendPct}%` }}
                />
              </div>
            )}
          </dd>
        </div>
      </dl>

      {requiresS72 && provider.s72AcknowledgedAt && (
        <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
          POPIA s.72 acknowledged{" "}
          {new Date(provider.s72AcknowledgedAt).toISOString().slice(0, 10)}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-ink)]"
        >
          <KeyRound className="size-3" aria-hidden />
          {provider.hasCredentials ? "Reconfigure" : "Configure"}
        </button>
        {provider.hasCredentials && !provider.active && (
          <button
            type="button"
            onClick={handleActivate}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-positive)]/60 bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-positive)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Play className="size-3" aria-hidden />
            )}
            Activate
          </button>
        )}
        {provider.hasCredentials && (
          <button
            type="button"
            onClick={() => setRotateOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
          >
            Rotate key
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-[color:var(--color-warning)]">
          {error}
        </p>
      )}

      {open && (
        <ConfigureForm
          provider={provider}
          requiresS72={requiresS72}
          onDone={() => setOpen(false)}
        />
      )}
      {rotateOpen && (
        <RotateForm
          providerId={provider.id}
          onDone={() => setRotateOpen(false)}
        />
      )}
    </li>
  );
}

function StatusChip({ provider }: { provider: LlmProviderView }) {
  if (provider.active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-positive)] bg-[color:var(--color-positive)]/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-positive)]">
        <CheckCircle2 className="size-3" aria-hidden /> Active
      </span>
    );
  }
  if (!provider.hasCredentials) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-ink-soft)]">
        Dormant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[color:var(--color-warning)]">
      <AlertTriangle className="size-3" aria-hidden /> Configured · inactive
    </span>
  );
}

function ConfigureForm({
  provider,
  requiresS72,
  onDone,
}: {
  provider: LlmProviderView;
  requiresS72: boolean;
  onDone: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [monthlyBudgetZar, setMonthlyBudgetZar] = useState<number>(
    provider.monthlyBudgetZar,
  );
  const [s72Acknowledged, setS72Acknowledged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await configureLlmProvider({
        providerId: provider.id as "openai" | "anthropic" | "mistral" | "self_hosted",
        apiKey,
        modelId,
        endpointUrl: endpointUrl.trim() || undefined,
        monthlyBudgetZar,
        s72Acknowledged: requiresS72 ? s72Acknowledged : undefined,
      });
      if (res.ok) {
        onDone();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4">
      <fieldset className="grid gap-3" disabled={pending}>
        <label className="grid gap-1 text-xs">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            API key
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Model id
          </span>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder={modelPlaceholder(provider.id)}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          />
        </label>
        {provider.id === "self_hosted" && (
          <label className="grid gap-1 text-xs">
            <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
              Endpoint URL (required)
            </span>
            <input
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://llm.internal.sebenza/v1/chat/completions"
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
            />
          </label>
        )}
        <label className="grid gap-1 text-xs">
          <span className="uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
            Monthly budget (ZAR)
          </span>
          <input
            type="number"
            min={0}
            max={1_000_000}
            step={50}
            value={monthlyBudgetZar}
            onChange={(e) =>
              setMonthlyBudgetZar(Math.max(0, Number(e.target.value)))
            }
            className="w-40 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm tabular-nums"
          />
          <span className="text-[color:var(--color-ink-soft)]">
            0 = no calls. The dispatcher refuses every request until you
            set a positive budget.
          </span>
        </label>

        {requiresS72 && (
          <label className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/5 p-3 text-xs">
            <input
              type="checkbox"
              checked={s72Acknowledged}
              onChange={(e) => setS72Acknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>POPIA s.72 acknowledgement.</strong> This provider
              processes the syllabus text outside South Africa. I
              acknowledge cross-border processing, confirm the input is
              generic academic text (no seeker PII), and accept the
              audit-trail responsibility. This timestamp lands in the
              provider row and the audit ledger.
            </span>
          </label>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !apiKey || !modelId}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving" : "Save configuration"}
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-xs text-[color:var(--color-warning)]">{error}</p>
        )}
      </fieldset>
    </div>
  );
}

function RotateForm({
  providerId,
  onDone,
}: {
  providerId: string;
  onDone: () => void;
}) {
  const [newApiKey, setNewApiKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await rotateLlmCredentials({
        providerId: providerId as "openai" | "anthropic" | "mistral" | "self_hosted",
        newApiKey,
      });
      if (res.ok) {
        onDone();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]">
        Rotate API key
      </p>
      <fieldset className="grid gap-3" disabled={pending}>
        <input
          type="password"
          value={newApiKey}
          onChange={(e) => setNewApiKey(e.target.value)}
          placeholder="new api key"
          className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-1.5 text-sm"
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !newApiKey}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Rotating" : "Rotate"}
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[color:var(--color-ink-soft)]"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-xs text-[color:var(--color-warning)]">{error}</p>
        )}
      </fieldset>
    </div>
  );
}

function modelPlaceholder(id: string): string {
  switch (id) {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-haiku-4-5";
    case "mistral":
      return "mistral-small-latest";
    case "self_hosted":
      return "meta-llama/Llama-3-8B-Instruct";
    default:
      return "";
  }
}
