"use client";

/**
 * PEXA workspace screens.
 *
 * PEXA is a web application, not a Windows app, so this uses its own visual
 * language (dark navy chrome, pill status bars) rather than the practice
 * management simulator's desktop styling.
 */

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CircleCheck,
  FileSignature,
  FileText,
  Landmark,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { SUBSCRIBERS } from "@/lib/pexa/seed";
import { formatAuDate, formatMoney, usePexa, type NewWorkspaceDraft } from "@/lib/pexa/store";
import {
  DESTINATION_CATEGORIES,
  PEXA_DOCUMENT_TYPES,
  PEXA_JURISDICTIONS,
  PEXA_ROLES,
  SOURCE_CATEGORIES,
  financialStatus,
  fundsBalance,
  fundsTotal,
  isDateAgreed,
  isReadyReady,
  lodgementStatus,
  type FundsDirection,
  type PexaDocumentType,
  type PexaJurisdiction,
  type PexaPrepStatus,
  type PexaRole,
  type PexaTab,
  type PexaWorkspace,
} from "@/lib/pexa/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: PexaPrepStatus | string }) {
  const tone =
    status === "Ready" || status === "Settled"
      ? "bg-[#0f9d58] text-white"
      : status === "Prepared" || status === "Booked" || status === "Ready to Book"
        ? "bg-[#f4a825] text-[#3d2c00]"
        : "bg-[#8494a6] text-white";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone,
      )}
    >
      {status}
    </span>
  );
}

export function PexaButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  title?: string;
}) {
  const v = {
    primary: "bg-[#00b0b9] text-white hover:bg-[#009aa2] border-[#00b0b9]",
    secondary: "bg-white text-[#1b3a57] hover:bg-[#eef4f8] border-[#c3d3df]",
    danger: "bg-white text-[#c8323b] hover:bg-[#fdeef0] border-[#f0b8bb]",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PexaInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-8 min-w-0 rounded-md border border-[#c3d3df] bg-white px-2.5 text-[12px] text-[#12263a] outline-none placeholder:text-[#9aabb9] focus:border-[#00b0b9] focus:ring-2 focus:ring-[#00b0b9]/25 disabled:bg-[#eef2f5]",
        className,
      )}
    />
  );
}

export function PexaSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "h-8 min-w-0 rounded-md border border-[#c3d3df] bg-white px-2 text-[12px] text-[#12263a] outline-none focus:border-[#00b0b9] focus:ring-2 focus:ring-[#00b0b9]/25",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold text-[#5b7286]">{children}</span>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-[#dbe5ed] bg-white", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-[#e6edf3] px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-[#12263a]">{title}</span>
          {actions}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function PexaDashboard() {
  const { state, dispatch } = usePexa();

  const toSign = state.workspaces.flatMap((w) =>
    w.documents
      .filter((d) => d.status !== "Signed" && d.responsibleRole === w.ourRole)
      .map((d) => ({ workspace: w, doc: d })),
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f6f9] p-4">
      <div className="mx-auto grid max-w-[1100px] gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-semibold text-[#12263a]">Workspaces</h2>
          <PexaButton
            className="ml-auto"
            onClick={() => dispatch({ type: "OPEN_CREATE_WORKSPACE" })}
          >
            <Plus className="size-3.5" />
            Create Workspace
          </PexaButton>
        </div>

        <Card title="Ready to Sign">
          {toSign.length === 0 ? (
            <p className="px-3.5 py-4 text-[12px] text-[#6b8296]">
              Nothing is waiting on your signature.
            </p>
          ) : (
            toSign.map(({ workspace, doc }) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => dispatch({ type: "OPEN_WORKSPACE", workspaceId: workspace.id })}
                className="flex w-full items-center gap-3 border-b border-[#eef3f7] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-[#f7fbfd]"
              >
                <FileSignature className="size-4 shrink-0 text-[#f4a825]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[#12263a]">
                    {doc.type} — {workspace.propertyAddress}
                  </span>
                  <span className="block text-[11px] text-[#6b8296]">
                    {workspace.workspaceNumber} · matter {workspace.matterNumber}
                  </span>
                </span>
                <StatusPill status={doc.status} />
              </button>
            ))
          )}
        </Card>

        <Card title={`All workspaces (${state.workspaces.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12px]">
              <thead>
                <tr className="border-b border-[#e6edf3] text-left text-[11px] font-semibold text-[#5b7286]">
                  <th className="px-3.5 py-2">Workspace</th>
                  <th className="px-3.5 py-2">Property</th>
                  <th className="px-3.5 py-2">Role</th>
                  <th className="px-3.5 py-2">Settlement</th>
                  <th className="px-3.5 py-2">Lodgement</th>
                  <th className="px-3.5 py-2">Financial</th>
                  <th className="px-3.5 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.workspaces.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => dispatch({ type: "OPEN_WORKSPACE", workspaceId: w.id })}
                    className="cursor-pointer border-b border-[#eef3f7] last:border-b-0 hover:bg-[#f7fbfd]"
                  >
                    <td className="px-3.5 py-2 font-medium text-[#00838f]">
                      {w.workspaceNumber}
                      {w.createdBySim && (
                        <span className="ml-1.5 rounded bg-[#e3f5e8] px-1 text-[10px] text-[#0f7a3d]">
                          new
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-[#12263a]">{w.propertyAddress}</td>
                    <td className="px-3.5 py-2 text-[#5b7286]">{w.ourRole}</td>
                    <td className="px-3.5 py-2 text-[#12263a]">
                      {w.settlementDate
                        ? `${formatAuDate(w.settlementDate)} ${w.settlementTime ?? ""}`
                        : "None — RTB"}
                    </td>
                    <td className="px-3.5 py-2">
                      <StatusPill status={lodgementStatus(w)} />
                    </td>
                    <td className="px-3.5 py-2">
                      {w.hasFinancialSettlement ? (
                        <StatusPill status={financialStatus(w)} />
                      ) : (
                        <span className="text-[11px] text-[#9aabb9]">No financial settlement</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2">
                      <StatusPill status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Notifications">
          {state.notifications.slice(0, 6).map((n) => {
            const w = state.workspaces.find((x) => x.id === n.workspaceId);
            return (
              <div key={n.id} className="flex gap-2 border-b border-[#eef3f7] px-3.5 py-2 last:border-b-0">
                <Bell
                  className={cn("mt-0.5 size-3.5 shrink-0", n.unread ? "text-[#00b0b9]" : "text-[#c3d3df]")}
                />
                <span className="min-w-0 text-[12px]">
                  <span className="block text-[#12263a]">{n.message}</span>
                  <span className="block text-[11px] text-[#6b8296]">
                    {w?.workspaceNumber} · {n.at}
                  </span>
                </span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create Workspace                                                    */
/* ------------------------------------------------------------------ */

const EMPTY_WS: NewWorkspaceDraft = {
  jurisdiction: "NSW",
  titleReference: "",
  propertyAddress: "",
  matterNumber: "",
  ourRole: null,
  hasFinancialSettlement: true,
};

export function PexaCreateWorkspace() {
  const { dispatch } = usePexa();
  const [draft, setDraft] = useState<NewWorkspaceDraft>(EMPTY_WS);
  const [attempted, setAttempted] = useState(false);

  const set = <K extends keyof NewWorkspaceDraft>(k: K, v: NewWorkspaceDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const missing: string[] = [];
  if (!draft.titleReference.trim()) missing.push("title reference");
  if (!draft.ourRole) missing.push("your role");
  const valid = missing.length === 0;

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f6f9] p-4">
      <div className="mx-auto grid max-w-[720px] gap-4">
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_WORKSPACE" })}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-[#00838f] hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to workspaces
        </button>

        <Card title="Create Workspace">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3 p-3.5">
            <label className="grid gap-1">
              <Label>Jurisdiction</Label>
              <PexaSelect
                value={draft.jurisdiction}
                onChange={(e) => set("jurisdiction", e.target.value as PexaJurisdiction)}
              >
                {PEXA_JURISDICTIONS.map((j) => (
                  <option key={j}>{j}</option>
                ))}
              </PexaSelect>
            </label>
            <label className="grid gap-1">
              <Label>Land title reference</Label>
              <PexaInput
                value={draft.titleReference}
                onChange={(e) => set("titleReference", e.target.value)}
                placeholder="e.g. 42/1104882"
              />
            </label>
            <label className="col-span-full grid gap-1">
              <Label>Property address</Label>
              <PexaInput
                value={draft.propertyAddress}
                onChange={(e) => set("propertyAddress", e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <Label>Your matter reference</Label>
              <PexaInput
                value={draft.matterNumber}
                onChange={(e) => set("matterNumber", e.target.value)}
                placeholder="e.g. 004182"
              />
            </label>
            <label className="grid gap-1">
              <Label>Your role</Label>
              <PexaSelect
                value={draft.ourRole ?? ""}
                onChange={(e) => set("ourRole", e.target.value as PexaRole)}
              >
                <option value="">Select a role…</option>
                {PEXA_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </PexaSelect>
            </label>
            <label className="col-span-full flex items-center gap-2 text-[12px] text-[#12263a]">
              <input
                type="checkbox"
                checked={draft.hasFinancialSettlement}
                onChange={(e) => set("hasFinancialSettlement", e.target.checked)}
                className="size-3.5 accent-[#00b0b9]"
              />
              This transaction has a financial settlement (money changes hands)
            </label>
            <p className="col-span-full text-[11px] text-[#6b8296]">
              Your role decides which documents you can create and sign. Choosing the wrong one
              means you cannot prepare the documents you are responsible for.
            </p>
          </div>
        </Card>

        {attempted && !valid && (
          <div className="rounded-lg border border-[#f0b8bb] bg-[#fdeef0] p-3 text-[12px] text-[#a02730]">
            Still missing: {missing.join(", ")}.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <PexaButton variant="secondary" onClick={() => dispatch({ type: "CLOSE_WORKSPACE" })}>
            Cancel
          </PexaButton>
          <PexaButton
            onClick={() => {
              setAttempted(true);
              if (!valid) return;
              dispatch({ type: "CREATE_WORKSPACE", draft });
              setDraft(EMPTY_WS);
              setAttempted(false);
            }}
          >
            Create Workspace
          </PexaButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace tabs                                                      */
/* ------------------------------------------------------------------ */

function SummaryTab({ ws }: { ws: PexaWorkspace }) {
  const { dispatch } = usePexa();
  const ready = isReadyReady(ws);
  const balance = fundsBalance(ws);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Card title="Lodgement">
          <div className="px-3.5 py-3">
            <StatusPill status={lodgementStatus(ws)} />
            <p className="mt-2 text-[11px] text-[#6b8296]">
              {ws.documents.length === 0
                ? "No documents created yet."
                : `${ws.documents.filter((d) => d.status === "Signed").length} of ${ws.documents.length} documents signed.`}
            </p>
          </div>
        </Card>
        <Card title="Financial Settlement">
          <div className="px-3.5 py-3">
            {ws.hasFinancialSettlement ? (
              <>
                <StatusPill status={financialStatus(ws)} />
                <p
                  className={cn(
                    "mt-2 text-[11px]",
                    balance === 0 ? "text-[#0f7a3d]" : "text-[#c8323b]",
                  )}
                >
                  {ws.funds.length === 0
                    ? "No line items yet."
                    : balance === 0
                      ? "Schedule balances."
                      : `Out by ${formatMoney(Math.abs(balance))} — ${balance > 0 ? "source exceeds destination" : "destination exceeds source"}.`}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-[#6b8296]">
                No financial settlement on this workspace.
              </p>
            )}
          </div>
        </Card>
        <Card title="Settlement date and time">
          <div className="px-3.5 py-3">
            <div className="text-[13px] font-semibold text-[#12263a]">
              {ws.settlementDate
                ? `${formatAuDate(ws.settlementDate)} ${ws.settlementTime ?? ""}`
                : "None — RTB"}
            </div>
            <p className="mt-1 text-[11px] text-[#6b8296]">
              {ws.settlementDate
                ? isDateAgreed(ws)
                  ? "Accepted by all participants."
                  : `Awaiting acceptance from ${ws.participants.filter((p) => !ws.acceptedBy.includes(p.id)).length} participant(s).`
                : "Ready to Book — no date proposed."}
            </p>
          </div>
        </Card>
      </div>

      <Card
        title={ready ? "Ready / Ready" : "Not yet Ready / Ready"}
        actions={
          ready && ws.status !== "Settled" ? (
            <PexaButton onClick={() => dispatch({ type: "SETTLE", workspaceId: ws.id })}>
              <CircleCheck className="size-3.5" />
              Settle
            </PexaButton>
          ) : undefined
        }
      >
        <div className="px-3.5 py-3">
          {ws.status === "Settled" ? (
            <p className="flex items-center gap-2 text-[12px] text-[#0f7a3d]">
              <CircleCheck className="size-4" />
              Settled. Documents lodged with the land registry and funds disbursed.
            </p>
          ) : ready ? (
            <p className="text-[12px] text-[#0f7a3d]">
              Everything is in place. The workspace will settle at the booked time.
            </p>
          ) : (
            <ul className="grid gap-1.5 text-[12px]">
              {[
                {
                  ok: lodgementStatus(ws) === "Ready",
                  label: "All registry documents signed",
                },
                {
                  ok: financialStatus(ws) === "Ready",
                  label: "Financial Settlement Schedule balanced",
                },
                { ok: Boolean(ws.settlementDate), label: "Settlement date and time proposed" },
                { ok: isDateAgreed(ws), label: "Date accepted by every participant" },
                {
                  ok: ws.participants.every((p) => p.accepted),
                  label: "All invited participants have joined",
                },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  {row.ok ? (
                    <Check className="size-3.5 shrink-0 text-[#0f9d58]" />
                  ) : (
                    <AlertTriangle className="size-3.5 shrink-0 text-[#f4a825]" />
                  )}
                  <span className={row.ok ? "text-[#6b8296]" : "text-[#12263a]"}>{row.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function ParticipantsTab({ ws }: { ws: PexaWorkspace }) {
  const { dispatch } = usePexa();
  const [subscriber, setSubscriber] = useState("");
  const [role, setRole] = useState<PexaRole>("Proprietor on Title");

  return (
    <div className="grid gap-4">
      <Card title={`Participants (${ws.participants.length})`}>
        {ws.participants.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex flex-wrap items-center gap-3 border-b border-[#eef3f7] px-3.5 py-2.5 last:border-b-0",
              p.createdBySim && "bg-[#f2fbf4]",
            )}
          >
            <Users className="size-4 shrink-0 text-[#5b7286]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-[#12263a]">
                {p.subscriberName}
                {p.isSelf && <span className="ml-1.5 text-[11px] text-[#6b8296]">(you)</span>}
              </span>
              <span className="block text-[11px] text-[#6b8296]">{p.role}</span>
            </span>
            <StatusPill status={p.accepted ? "Ready" : "In Preparation"} />
            <span className="text-[11px] text-[#6b8296]">
              {p.accepted ? "Joined" : "Invitation pending"}
            </span>
          </div>
        ))}
      </Card>

      <Card title="Invite a participant">
        <div className="flex flex-wrap items-end gap-2 p-3.5">
          <label className="grid min-w-[220px] flex-1 gap-1">
            <Label>Subscriber</Label>
            <PexaSelect value={subscriber} onChange={(e) => setSubscriber(e.target.value)}>
              <option value="">Select a subscriber…</option>
              {SUBSCRIBERS.filter(
                (s) => !ws.participants.some((p) => p.subscriberName === s),
              ).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </PexaSelect>
          </label>
          <label className="grid min-w-[190px] gap-1">
            <Label>Their role</Label>
            <PexaSelect value={role} onChange={(e) => setRole(e.target.value as PexaRole)}>
              {PEXA_ROLES.filter((r) => r !== ws.ourRole).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </PexaSelect>
          </label>
          <PexaButton
            disabled={!subscriber}
            onClick={() => {
              dispatch({
                type: "INVITE_PARTICIPANT",
                workspaceId: ws.id,
                subscriberName: subscriber,
                role,
              });
              setSubscriber("");
            }}
          >
            Send invitation
          </PexaButton>
        </div>
        <p className="px-3.5 pb-3 text-[11px] text-[#6b8296]">
          Say which role you are inviting them as. Invite the wrong role and they cannot prepare
          the documents the transaction needs.
        </p>
      </Card>
    </div>
  );
}

function DocumentsTab({ ws }: { ws: PexaWorkspace }) {
  const { dispatch } = usePexa();
  const [docType, setDocType] = useState<PexaDocumentType>("Transfer");

  return (
    <div className="grid gap-4">
      <Card title={`Documents (${ws.documents.length})`}>
        {ws.documents.length === 0 ? (
          <p className="px-3.5 py-4 text-[12px] text-[#6b8296]">
            No documents yet. Registry documents must be created and signed before lodgement can
            reach Ready.
          </p>
        ) : (
          ws.documents.map((d) => {
            const ours = d.responsibleRole === ws.ourRole;
            return (
              <div
                key={d.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b border-[#eef3f7] px-3.5 py-2.5 last:border-b-0",
                  d.createdBySim && "bg-[#f2fbf4]",
                )}
              >
                <FileText className="size-4 shrink-0 text-[#5b7286]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium text-[#12263a]">{d.type}</span>
                  <span className="block text-[11px] text-[#6b8296]">
                    {d.responsibleRole}
                    {d.signedBy ? ` · signed by ${d.signedBy} on ${formatAuDate(d.signedAt)}` : ""}
                  </span>
                </span>
                <StatusPill status={d.status} />
                {d.status !== "Signed" && (
                  <PexaButton
                    disabled={!ours}
                    title={
                      ours
                        ? "Sign this document"
                        : `Only the ${d.responsibleRole} can sign this document`
                    }
                    onClick={() =>
                      dispatch({ type: "SIGN_DOCUMENT", workspaceId: ws.id, documentId: d.id })
                    }
                  >
                    <FileSignature className="size-3.5" />
                    Sign
                  </PexaButton>
                )}
              </div>
            );
          })
        )}
      </Card>

      <Card title="Create a document">
        <div className="flex flex-wrap items-end gap-2 p-3.5">
          <label className="grid min-w-[220px] gap-1">
            <Label>Document type</Label>
            <PexaSelect
              value={docType}
              onChange={(e) => setDocType(e.target.value as PexaDocumentType)}
            >
              {PEXA_DOCUMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </PexaSelect>
          </label>
          <PexaButton
            onClick={() =>
              dispatch({ type: "CREATE_DOCUMENT", workspaceId: ws.id, documentType: docType })
            }
          >
            <Plus className="size-3.5" />
            Create
          </PexaButton>
        </div>
        <p className="px-3.5 pb-3 text-[11px] text-[#6b8296]">
          You can only sign documents your role is responsible for. Signing is done under the
          Client Authorisation your client signed — never sign without one on file.
        </p>
      </Card>
    </div>
  );
}

function FinancialTab({ ws }: { ws: PexaWorkspace }) {
  const { dispatch } = usePexa();
  const [direction, setDirection] = useState<FundsDirection>("Source");
  const [category, setCategory] = useState(SOURCE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  if (!ws.hasFinancialSettlement) {
    return (
      <Card title="Financial Settlement Schedule">
        <p className="px-3.5 py-4 text-[12px] text-[#6b8296]">
          This workspace has no financial settlement, so there is no schedule to balance. The
          documents still have to be signed and lodged.
        </p>
      </Card>
    );
  }

  const source = fundsTotal(ws, "Source");
  const destination = fundsTotal(ws, "Destination");
  const balance = fundsBalance(ws);
  const categories = direction === "Source" ? SOURCE_CATEGORIES : DESTINATION_CATEGORIES;
  const amountValue = Number(amount.replace(/[^0-9.]/g, ""));
  const canAdd = description.trim().length > 0 && amountValue > 0;

  const rows = (dir: FundsDirection) => ws.funds.filter((f) => f.direction === dir);

  return (
    <div className="grid gap-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-lg border px-3.5 py-3",
          balance === 0
            ? "border-[#a8ddb8] bg-[#eefaf1]"
            : "border-[#f0b8bb] bg-[#fdeef0]",
        )}
      >
        <div>
          <Label>Source funds</Label>
          <div className="text-[15px] font-semibold text-[#12263a]">{formatMoney(source)}</div>
        </div>
        <div>
          <Label>Destination funds</Label>
          <div className="text-[15px] font-semibold text-[#12263a]">{formatMoney(destination)}</div>
        </div>
        <div className="ml-auto text-right">
          <Label>Balance</Label>
          <div
            className={cn(
              "text-[15px] font-semibold",
              balance === 0 ? "text-[#0f7a3d]" : "text-[#c8323b]",
            )}
          >
            {balance === 0 ? "Balanced" : formatMoney(balance)}
          </div>
        </div>
      </div>

      {balance !== 0 && (
        <p className="flex items-start gap-2 text-[12px] text-[#a02730]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          The schedule must balance exactly before settlement. Source and destination totals have
          to match to the cent.
        </p>
      )}

      {(["Source", "Destination"] as FundsDirection[]).map((dir) => (
        <Card key={dir} title={`${dir} funds`}>
          {rows(dir).length === 0 ? (
            <p className="px-3.5 py-3 text-[12px] text-[#6b8296]">No {dir.toLowerCase()} line items.</p>
          ) : (
            rows(dir).map((f) => (
              <div
                key={f.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b border-[#eef3f7] px-3.5 py-2 last:border-b-0",
                  f.createdBySim && "bg-[#f2fbf4]",
                )}
              >
                {dir === "Source" ? (
                  <Wallet className="size-3.5 shrink-0 text-[#5b7286]" />
                ) : (
                  <Landmark className="size-3.5 shrink-0 text-[#5b7286]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-[#12263a]">{f.description}</span>
                  <span className="block text-[11px] text-[#6b8296]">{f.category}</span>
                </span>
                <span className="text-[12px] font-semibold text-[#12263a]">
                  {formatMoney(f.amount)}
                </span>
                {f.locked ? (
                  <span
                    title="Pre-populated by PEXA and cannot be edited"
                    className="text-[10px] text-[#9aabb9]"
                  >
                    locked
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "REMOVE_FUNDS_LINE", workspaceId: ws.id, lineId: f.id })
                    }
                    title="Remove line item"
                    className="text-[#c8323b] hover:text-[#a02730]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </Card>
      ))}

      <Card title="Add a line item">
        <div className="flex flex-wrap items-end gap-2 p-3.5">
          <label className="grid gap-1">
            <Label>Direction</Label>
            <PexaSelect
              value={direction}
              onChange={(e) => {
                const next = e.target.value as FundsDirection;
                setDirection(next);
                setCategory(
                  next === "Source" ? SOURCE_CATEGORIES[0] : DESTINATION_CATEGORIES[0],
                );
              }}
            >
              <option>Source</option>
              <option>Destination</option>
            </PexaSelect>
          </label>
          <label className="grid min-w-[180px] gap-1">
            <Label>Category</Label>
            <PexaSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </PexaSelect>
          </label>
          <label className="grid min-w-[220px] flex-1 gap-1">
            <Label>Description</Label>
            <PexaInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this line for?"
            />
          </label>
          <label className="grid w-[130px] gap-1">
            <Label>Amount</Label>
            <PexaInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-right"
            />
          </label>
          <PexaButton
            disabled={!canAdd}
            onClick={() => {
              dispatch({
                type: "ADD_FUNDS_LINE",
                workspaceId: ws.id,
                direction,
                category,
                description: description.trim(),
                amount: Math.round(amountValue * 100) / 100,
              });
              setDescription("");
              setAmount("");
            }}
          >
            <Plus className="size-3.5" />
            Add
          </PexaButton>
        </div>
      </Card>
    </div>
  );
}

function SettlementTab({ ws }: { ws: PexaWorkspace }) {
  const { state, dispatch } = usePexa();
  const [date, setDate] = useState(ws.settlementDate ?? "");
  const [time, setTime] = useState(ws.settlementTime ?? "11:00 AM");
  const self = ws.participants.find((p) => p.isSelf);
  const weAccepted = self ? ws.acceptedBy.includes(self.id) : false;

  const TIMES = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM"];

  return (
    <div className="grid gap-4">
      <Card title="Settlement date and time">
        <div className="px-3.5 py-3">
          <div className="text-[15px] font-semibold text-[#12263a]">
            {ws.settlementDate
              ? `${formatAuDate(ws.settlementDate)} at ${ws.settlementTime}`
              : "None — RTB"}
          </div>
          <p className="mt-1 text-[11px] text-[#6b8296]">
            {ws.proposedBy ? `Proposed by ${ws.proposedBy}.` : "No date proposed yet."}{" "}
            {ws.settlementDate &&
              (isDateAgreed(ws)
                ? "All participants have accepted."
                : "Not yet accepted by everyone.")}
          </p>

          <div className="mt-3 grid gap-1.5">
            {ws.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[12px]">
                {ws.acceptedBy.includes(p.id) ? (
                  <Check className="size-3.5 shrink-0 text-[#0f9d58]" />
                ) : (
                  <AlertTriangle className="size-3.5 shrink-0 text-[#f4a825]" />
                )}
                <span className="text-[#12263a]">{p.subscriberName}</span>
                <span className="text-[#6b8296]">
                  {ws.acceptedBy.includes(p.id) ? "accepted" : "awaiting acceptance"}
                </span>
              </div>
            ))}
          </div>

          {ws.settlementDate && !weAccepted && (
            <PexaButton
              className="mt-3"
              onClick={() => dispatch({ type: "ACCEPT_SETTLEMENT", workspaceId: ws.id })}
            >
              Accept settlement date and time
            </PexaButton>
          )}
        </div>
      </Card>

      <Card title="Accept or Propose New Settlement Date and Time">
        <div className="flex flex-wrap items-end gap-2 p-3.5">
          <label className="grid gap-1">
            <Label>Settlement Date</Label>
            <PexaInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <Label>Settlement Time</Label>
            <PexaSelect value={time} onChange={(e) => setTime(e.target.value)}>
              {TIMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </PexaSelect>
          </label>
          <PexaButton
            disabled={!date}
            onClick={() =>
              dispatch({ type: "PROPOSE_SETTLEMENT", workspaceId: ws.id, date, time })
            }
          >
            Propose new date and time
          </PexaButton>
        </div>
        <p className="px-3.5 pb-3 text-[11px] text-[#6b8296]">
          Proposing a new date clears everyone else&apos;s acceptance — they all have to agree
          again. Never re-propose a date without telling the other side first.
        </p>
      </Card>

      {state.today > (ws.settlementDate ?? "9999-12-31") && ws.status !== "Settled" && (
        <p className="text-[12px] text-[#a02730]">
          This settlement date has passed and the workspace has not settled.
        </p>
      )}
    </div>
  );
}

function NotificationsTab({ ws }: { ws: PexaWorkspace }) {
  const { state } = usePexa();
  const items = state.notifications.filter((n) => n.workspaceId === ws.id);
  return (
    <Card title={`Notifications (${items.length})`}>
      {items.length === 0 ? (
        <p className="px-3.5 py-4 text-[12px] text-[#6b8296]">Nothing yet on this workspace.</p>
      ) : (
        items.map((n) => (
          <div key={n.id} className="flex gap-2 border-b border-[#eef3f7] px-3.5 py-2.5 last:border-b-0">
            <Bell
              className={cn("mt-0.5 size-3.5 shrink-0", n.unread ? "text-[#00b0b9]" : "text-[#c3d3df]")}
            />
            <span className="min-w-0 text-[12px]">
              <span className="block text-[#12263a]">{n.message}</span>
              <span className="block text-[11px] text-[#6b8296]">{n.at}</span>
            </span>
          </div>
        ))
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace shell                                                     */
/* ------------------------------------------------------------------ */

const TABS: { key: PexaTab; label: string }[] = [
  { key: "summary", label: "Workspace Summary" },
  { key: "participants", label: "Participants" },
  { key: "documents", label: "Documents" },
  { key: "financial", label: "Financial Settlement Schedule" },
  { key: "settlement", label: "Settlement" },
  { key: "notifications", label: "Notifications" },
];

export function PexaWorkspaceScreen() {
  const { state, dispatch, workspace } = usePexa();
  if (!workspace) return null;
  const tab = state.nav.tab;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f2f6f9]">
      <div className="shrink-0 bg-[#12263a] px-4 py-3 text-white">
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_WORKSPACE" })}
          className="mb-2 inline-flex items-center gap-1 text-[12px] text-white/75 hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Workspaces
        </button>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">{workspace.propertyAddress}</div>
            <div className="text-[12px] text-white/70">
              {workspace.workspaceNumber} · {workspace.jurisdiction} ·{" "}
              {workspace.titleReference} · your role: {workspace.ourRole} · matter{" "}
              {workspace.matterNumber}
            </div>
          </div>
          <StatusPill status={workspace.status} />
        </div>
      </div>

      <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-[#dbe5ed] bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => dispatch({ type: "SET_TAB", tab: t.key })}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-[12px] font-semibold transition-colors",
              tab === t.key
                ? "border-[#00b0b9] text-[#12263a]"
                : "border-transparent text-[#6b8296] hover:text-[#12263a]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-[1000px]">
          {tab === "summary" && <SummaryTab ws={workspace} />}
          {tab === "participants" && <ParticipantsTab ws={workspace} />}
          {tab === "documents" && <DocumentsTab ws={workspace} />}
          {tab === "financial" && <FinancialTab ws={workspace} />}
          {tab === "settlement" && <SettlementTab ws={workspace} />}
          {tab === "notifications" && <NotificationsTab ws={workspace} />}
        </div>
      </div>
    </div>
  );
}
