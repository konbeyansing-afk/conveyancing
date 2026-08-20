"use client";

/**
 * Modals opened by the ribbon's create actions.
 *
 * These exist so the ribbon isn't decoration: New Contact, Phone Message and
 * New Document all produce real records the trainee can then find again in the
 * relevant pane.
 */

import { useState } from "react";
import { CONTACT_CATEGORIES, PRECEDENTS, SIM_STAFF } from "@/lib/simulator/seed";
import { useSim } from "@/lib/simulator/store";
import {
  SimActionButton,
  SimDialog,
  SimFieldLabel,
  SimInput,
  SimSelect,
  SimTextarea,
} from "./sim-primitives";

/** Which ribbon dialog is currently open, if any. */
export type RibbonDialog = "contact" | "phone" | "document" | "memo-picker" | null;

export function NewContactDialog({ onClose }: { onClose: () => void }) {
  const { dispatch } = useSim();
  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [category, setCategory] = useState(CONTACT_CATEGORIES[0]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const valid = name.trim().length > 0;

  return (
    <SimDialog
      title="New contact"
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton
            disabled={!valid}
            onClick={() => {
              dispatch({
                type: "ADD_CONTACT",
                name: name.trim(),
                organisation: organisation.trim(),
                category,
                email: email.trim(),
                phone: phone.trim(),
              });
              onClose();
            }}
          >
            Save contact
          </SimActionButton>
        </>
      }
    >
      <label className="grid gap-1">
        <SimFieldLabel>Name</SimFieldLabel>
        <SimInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Person or organisation name"
        />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Organisation</SimFieldLabel>
        <SimInput
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          placeholder="Leave blank for an individual"
        />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Category</SimFieldLabel>
        <SimSelect value={category} onChange={(e) => setCategory(e.target.value)}>
          {CONTACT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SimSelect>
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Email</SimFieldLabel>
        <SimInput value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Phone</SimFieldLabel>
        <SimInput value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <p className="text-[11px] text-[#7a5c10]">
        New contacts always save as risk-assessment Incomplete. Verification is a separate step —
        creating the contact record is not the same as verifying who they are.
      </p>
    </SimDialog>
  );
}

export function PhoneMessageDialog({
  onClose,
  fixedMatterId,
}: {
  onClose: () => void;
  fixedMatterId?: string;
}) {
  const { state, dispatch } = useSim();
  const [matterId, setMatterId] = useState(fixedMatterId ?? "");
  const [caller, setCaller] = useState("");
  const [callerPhone, setCallerPhone] = useState("");
  const [forStaff, setForStaff] = useState(SIM_STAFF[0]);
  const [summary, setSummary] = useState("");

  const valid = caller.trim().length > 0 && summary.trim().length > 0;

  return (
    <SimDialog
      title="Phone message"
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton
            disabled={!valid}
            onClick={() => {
              dispatch({
                type: "ADD_PHONE_MESSAGE",
                matterId: matterId || null,
                caller: caller.trim(),
                callerPhone: callerPhone.trim(),
                summary: summary.trim(),
                forStaff,
              });
              onClose();
            }}
          >
            Save message
          </SimActionButton>
        </>
      }
    >
      {!fixedMatterId && (
        <label className="grid gap-1">
          <SimFieldLabel>Matter (optional)</SimFieldLabel>
          <SimSelect value={matterId} onChange={(e) => setMatterId(e.target.value)}>
            <option value="">No matter</option>
            {state.matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.number} — {m.clientName}
              </option>
            ))}
          </SimSelect>
        </label>
      )}
      <label className="grid gap-1">
        <SimFieldLabel>Caller</SimFieldLabel>
        <SimInput
          value={caller}
          onChange={(e) => setCaller(e.target.value)}
          placeholder="Who rang?"
        />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Their number</SimFieldLabel>
        <SimInput value={callerPhone} onChange={(e) => setCallerPhone(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Message for</SimFieldLabel>
        <SimSelect value={forStaff} onChange={(e) => setForStaff(e.target.value)}>
          {SIM_STAFF.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SimSelect>
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Message</SimFieldLabel>
        <SimTextarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What did they say, and what do they need back?"
        />
      </label>
    </SimDialog>
  );
}

export function NewDocumentDialog({
  onClose,
  fixedMatterId,
  source = "created from precedent",
}: {
  onClose: () => void;
  fixedMatterId?: string;
  source?: string;
}) {
  const { state, dispatch } = useSim();
  const [matterId, setMatterId] = useState(fixedMatterId ?? "");
  const [precedent, setPrecedent] = useState(PRECEDENTS[0]);
  const [custom, setCustom] = useState("");

  const name = custom.trim() || precedent;
  const valid = matterId.length > 0 && name.length > 0;

  return (
    <SimDialog
      title={source === "imported" ? "Import document" : "New document"}
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton
            disabled={!valid}
            onClick={() => {
              dispatch({ type: "ADD_DOCUMENT", matterId, name, source });
              onClose();
            }}
          >
            Create
          </SimActionButton>
        </>
      }
    >
      {!fixedMatterId && (
        <label className="grid gap-1">
          <SimFieldLabel>Matter</SimFieldLabel>
          <SimSelect value={matterId} onChange={(e) => setMatterId(e.target.value)}>
            <option value="">Select a matter…</option>
            {state.matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.number} — {m.clientName}
              </option>
            ))}
          </SimSelect>
        </label>
      )}
      <label className="grid gap-1">
        <SimFieldLabel>Precedent</SimFieldLabel>
        <SimSelect value={precedent} onChange={(e) => setPrecedent(e.target.value)}>
          {PRECEDENTS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </SimSelect>
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Or type a document name</SimFieldLabel>
        <SimInput
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Overrides the precedent above"
        />
      </label>
      <p className="text-[11px] text-[#5b6b7d]">
        The document is added to the matter&apos;s Documents list and logged on the Activity tab.
        Editing document content is outside the simulator.
      </p>
    </SimDialog>
  );
}

export function EmailComposeDialog({
  onClose,
  matterId,
}: {
  onClose: () => void;
  matterId: string;
}) {
  const { state, dispatch } = useSim();
  const matter = state.matters.find((m) => m.id === matterId);
  const [to, setTo] = useState(matter?.clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const valid = to.trim().length > 0 && subject.trim().length > 0 && body.trim().length > 0;

  return (
    <SimDialog
      title="New email"
      width={560}
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton
            variant="primary"
            disabled={!valid}
            onClick={() => {
              dispatch({
                type: "ADD_EMAIL",
                matterId,
                to: to.trim(),
                subject: subject.trim(),
                body: body.trim(),
              });
              onClose();
            }}
          >
            Send
          </SimActionButton>
        </>
      }
    >
      <label className="grid gap-1">
        <SimFieldLabel>To</SimFieldLabel>
        <SimInput value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Subject</SimFieldLabel>
        <SimInput
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={matter ? `${matter.type} — ${matter.propertyAddress}` : ""}
        />
      </label>
      <label className="grid gap-1">
        <SimFieldLabel>Message</SimFieldLabel>
        <SimTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[160px]"
          placeholder="Write as you would to a real client — plain English, no legal advice, and say what you need back and by when."
        />
      </label>
      <p className="text-[11px] text-[#5b6b7d]">
        Sent mail is filed against the matter automatically. Nothing leaves the simulator.
      </p>
    </SimDialog>
  );
}

/** Asks which matter to jump to, for ribbon actions that need a file first. */
export function MatterPickerDialog({
  onClose,
  title,
  tab,
}: {
  onClose: () => void;
  title: string;
  tab: "memos" | "emails" | "tasks" | "events";
}) {
  const { state, dispatch } = useSim();
  const [matterId, setMatterId] = useState("");

  return (
    <SimDialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <SimActionButton variant="plain" onClick={onClose}>
            Cancel
          </SimActionButton>
          <SimActionButton
            disabled={matterId.length === 0}
            onClick={() => {
              dispatch({ type: "OPEN_MATTER", matterId });
              dispatch({ type: "MATTER_TAB", tab });
              onClose();
            }}
          >
            Open
          </SimActionButton>
        </>
      }
    >
      <label className="grid gap-1">
        <SimFieldLabel>Matter</SimFieldLabel>
        <SimSelect value={matterId} onChange={(e) => setMatterId(e.target.value)}>
          <option value="">Select a matter…</option>
          {state.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.number} — {m.clientName}
            </option>
          ))}
        </SimSelect>
      </label>
      <p className="text-[11px] text-[#5b6b7d]">
        Memos, emails, tasks and events always belong to a file — the system asks which one before
        it opens the editor.
      </p>
    </SimDialog>
  );
}
