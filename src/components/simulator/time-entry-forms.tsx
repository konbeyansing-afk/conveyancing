"use client";

/**
 * Time & fee and disbursement entry grids.
 *
 * Used in two places, exactly as in the real app: firm-wide from the
 * TIME & DISBURSEMENTS menu (where you must pick a matter), and inside a
 * single matter's own tab (where the matter is fixed).
 */

import { useState } from "react";
import { ACTIVITY_CODES, DISBURSEMENT_CODES } from "@/lib/simulator/seed";
import { formatAuDate, formatMoney, useSim } from "@/lib/simulator/store";
import { cn } from "@/lib/utils";
import {
  EmptyPane,
  GridCell,
  GridHeader,
  GridRow,
  SimActionButton,
  SimCheckbox,
  SimFieldLabel,
  SimInput,
  SimSelect,
} from "./sim-primitives";

const GST_RATE = 0.1;

function toNumber(v: string): number {
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ */
/* Time & fees                                                         */
/* ------------------------------------------------------------------ */

export function TimeFeesGrid({ fixedMatterId }: { fixedMatterId?: string }) {
  const { state, dispatch } = useSim();
  const [matterId, setMatterId] = useState(fixedMatterId ?? "");
  const [activityCode, setActivityCode] = useState("");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<"Fixed" | "Hrs" | "Units">("Hrs");
  const [duration, setDuration] = useState("");
  const [rate, setRate] = useState("");
  const [billable, setBillable] = useState(true);

  const effectiveMatterId = fixedMatterId ?? matterId;
  const rows = state.timeEntries.filter((t) =>
    effectiveMatterId ? t.matterId === effectiveMatterId : true,
  );

  const hours = mode === "Fixed" ? null : toNumber(duration);
  const rateValue = toNumber(rate);
  const amountExGst = mode === "Fixed" ? rateValue : (hours ?? 0) * rateValue;
  const gst = Math.round(amountExGst * GST_RATE * 100) / 100;

  const canAdd =
    effectiveMatterId.length > 0 &&
    subject.trim().length > 0 &&
    activityCode.length > 0 &&
    amountExGst > 0;

  function add() {
    if (!canAdd) return;
    dispatch({
      type: "ADD_TIME_ENTRY",
      entry: {
        matterId: effectiveMatterId,
        date: state.today,
        staff: state.user.name,
        activityCode,
        subject: subject.trim(),
        billingMode: mode,
        hours,
        rate: rateValue,
        amountExGst,
        gst,
        billable,
        billedInvoice: null,
      },
    });
    setSubject("");
    setDuration("");
    setRate("");
    setActivityCode("");
  }

  const totalBillable = rows.filter((r) => r.billable).reduce((s, r) => s + r.amountExGst, 0);
  const totalHours = rows.reduce((s, r) => s + (r.hours ?? 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Entry row */}
      <div className="shrink-0 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
        <div className="flex flex-wrap items-end gap-2">
          {!fixedMatterId && (
            <label className="grid w-[230px] gap-1">
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
          <label className="grid w-[110px] gap-1">
            <SimFieldLabel>Date</SimFieldLabel>
            <SimInput value={formatAuDate(state.today)} readOnly />
          </label>
          <label className="grid w-[130px] gap-1">
            <SimFieldLabel>Staff</SimFieldLabel>
            <SimInput value={state.user.name} readOnly />
          </label>
          <label className="grid w-[110px] gap-1">
            <SimFieldLabel>Activity</SimFieldLabel>
            <SimSelect value={activityCode} onChange={(e) => setActivityCode(e.target.value)}>
              <option value="">—</option>
              {ACTIVITY_CODES.map((a) => (
                <option key={a.code} value={a.code} title={a.label}>
                  {a.code}
                </option>
              ))}
            </SimSelect>
          </label>
          <label className="grid min-w-[220px] flex-1 gap-1">
            <SimFieldLabel>Subject</SimFieldLabel>
            <SimInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What did you do?"
            />
          </label>
          <div className="grid gap-1">
            <SimFieldLabel>Duration</SimFieldLabel>
            <div className="flex items-center">
              <SimInput
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={mode === "Fixed"}
                placeholder="0.00"
                className="w-[70px] rounded-r-none text-right"
              />
              {(["Fixed", "Hrs", "Units"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-[26px] border border-l-0 border-[#a9bcd0] px-2 text-[11px]",
                    mode === m ? "bg-[#dcebfa] font-semibold text-[#22303f]" : "bg-white text-[#5b6b7d]",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <label className="grid w-[100px] gap-1">
            <SimFieldLabel>{mode === "Fixed" ? "Fee $" : "Rate $/hr"}</SimFieldLabel>
            <SimInput
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              className="text-right"
            />
          </label>
          <label className="grid w-[100px] gap-1">
            <SimFieldLabel>Amount</SimFieldLabel>
            <SimInput value={amountExGst ? formatMoney(amountExGst) : "$0.00"} readOnly className="text-right" />
          </label>
          <label className="grid w-[90px] gap-1">
            <SimFieldLabel>GST</SimFieldLabel>
            <SimInput value={gst ? formatMoney(gst) : "$0.00"} readOnly className="text-right" />
          </label>
          <div className="grid gap-1">
            <SimFieldLabel>Billable</SimFieldLabel>
            <div className="flex h-[26px] items-center">
              <SimCheckbox checked={billable} onChange={setBillable} />
            </div>
          </div>
          <SimActionButton onClick={add} disabled={!canAdd}>
            Add
          </SimActionButton>
        </div>
        {mode !== "Fixed" && (
          <p className="mt-1.5 text-[11px] text-[#5b6b7d]">
            Enter time in decimal hours — 18 minutes is 0.30, not 0.18.
          </p>
        )}
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        <GridHeader>
          <GridCell width={90}>Date</GridCell>
          <GridCell width={120}>Staff</GridCell>
          <GridCell width={80}>Activity</GridCell>
          <GridCell grow>Subject</GridCell>
          <GridCell width={80}>Billing</GridCell>
          <GridCell width={70}>Hrs</GridCell>
          <GridCell width={100}>Amount ex GST</GridCell>
          <GridCell width={80}>GST</GridCell>
          <GridCell width={70}>Billable</GridCell>
          <GridCell width={70}>Billed</GridCell>
        </GridHeader>
        {rows.length === 0 ? (
          <EmptyPane>No time recorded yet.</EmptyPane>
        ) : (
          rows.map((t) => (
            <GridRow key={t.id} className={cn(t.createdBySim && "bg-[#f2fbf4]")}>
              <GridCell width={90}>{formatAuDate(t.date)}</GridCell>
              <GridCell width={120}>{t.staff}</GridCell>
              <GridCell width={80}>{t.activityCode}</GridCell>
              <GridCell grow>{t.subject}</GridCell>
              <GridCell width={80}>{t.billingMode}</GridCell>
              <GridCell width={70}>{t.hours !== null ? t.hours.toFixed(2) : "—"}</GridCell>
              <GridCell width={100} className="text-right">
                {formatMoney(t.amountExGst)}
              </GridCell>
              <GridCell width={80} className="text-right">
                {formatMoney(t.gst)}
              </GridCell>
              <GridCell width={70}>{t.billable ? "Yes" : "No"}</GridCell>
              <GridCell width={70} className="text-[#2f7fd0]">
                {t.billedInvoice ?? "—"}
              </GridCell>
            </GridRow>
          ))
        )}
      </div>

      <div className="flex h-[28px] shrink-0 items-center gap-6 border-t border-[#dfe5ec] bg-[#f7fafc] px-3 text-[11px] text-[#3c4653]">
        <span>{totalHours.toFixed(1)} hrs logged</span>
        <span className="font-semibold">{formatMoney(totalBillable)} billable</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Disbursements                                                       */
/* ------------------------------------------------------------------ */

export function DisbursementsGrid({ fixedMatterId }: { fixedMatterId?: string }) {
  const { state, dispatch } = useSim();
  const [matterId, setMatterId] = useState(fixedMatterId ?? "");
  const [activityCode, setActivityCode] = useState("");
  const [subject, setSubject] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [gstInclusive, setGstInclusive] = useState(false);
  const [billable, setBillable] = useState(true);

  const effectiveMatterId = fixedMatterId ?? matterId;
  const rows = state.disbursements.filter((d) =>
    effectiveMatterId ? d.matterId === effectiveMatterId : true,
  );

  const gross = toNumber(quantity) * toNumber(price);
  // GST INC means the price already contains the GST, so divide by 11.
  const gst = gstInclusive ? Math.round((gross / 11) * 100) / 100 : 0;
  const amountExGst = Math.round((gross - gst) * 100) / 100;

  const canAdd =
    effectiveMatterId.length > 0 && subject.trim().length > 0 && activityCode.length > 0 && gross > 0;

  function add() {
    if (!canAdd) return;
    dispatch({
      type: "ADD_DISBURSEMENT",
      entry: {
        matterId: effectiveMatterId,
        date: state.today,
        staff: state.user.name,
        activityCode,
        subject: subject.trim(),
        quantity: toNumber(quantity),
        price: toNumber(price),
        amountExGst,
        gst,
        gstInclusive,
        billable,
        billedInvoice: null,
      },
    });
    setSubject("");
    setPrice("");
    setQuantity("1");
    setActivityCode("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[#dfe5ec] bg-[#f7fafc] px-3 py-2">
        <div className="flex flex-wrap items-end gap-2">
          {!fixedMatterId && (
            <label className="grid w-[230px] gap-1">
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
          <label className="grid w-[110px] gap-1">
            <SimFieldLabel>Activity</SimFieldLabel>
            <SimSelect value={activityCode} onChange={(e) => setActivityCode(e.target.value)}>
              <option value="">—</option>
              {DISBURSEMENT_CODES.map((d) => (
                <option key={d.code} value={d.code} title={d.label}>
                  {d.code}
                </option>
              ))}
            </SimSelect>
          </label>
          <label className="grid min-w-[240px] flex-1 gap-1">
            <SimFieldLabel>Subject</SimFieldLabel>
            <SimInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What was paid for?"
            />
          </label>
          <label className="grid w-[80px] gap-1">
            <SimFieldLabel>Quantity</SimFieldLabel>
            <SimInput
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="text-right"
            />
          </label>
          <label className="grid w-[100px] gap-1">
            <SimFieldLabel>Price $</SimFieldLabel>
            <SimInput
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="text-right"
            />
          </label>
          <label className="grid w-[110px] gap-1">
            <SimFieldLabel>Amount ex GST</SimFieldLabel>
            <SimInput value={formatMoney(amountExGst)} readOnly className="text-right" />
          </label>
          <label className="grid w-[90px] gap-1">
            <SimFieldLabel>GST</SimFieldLabel>
            <SimInput value={formatMoney(gst)} readOnly className="text-right" />
          </label>
          <div className="grid gap-1">
            <SimFieldLabel>GST inc</SimFieldLabel>
            <div className="flex h-[26px] items-center">
              <SimCheckbox checked={gstInclusive} onChange={setGstInclusive} />
            </div>
          </div>
          <div className="grid gap-1">
            <SimFieldLabel>Billable</SimFieldLabel>
            <div className="flex h-[26px] items-center">
              <SimCheckbox checked={billable} onChange={setBillable} />
            </div>
          </div>
          <SimActionButton onClick={add} disabled={!canAdd}>
            Add
          </SimActionButton>
        </div>
        <p className="mt-1.5 text-[11px] text-[#5b6b7d]">
          Tick GST INC when the figure on the invoice already includes GST — the system then divides
          by 11 instead of adding 10% on top.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <GridHeader>
          <GridCell width={90}>Date</GridCell>
          <GridCell width={80}>Activity</GridCell>
          <GridCell grow>Subject</GridCell>
          <GridCell width={70}>Qty</GridCell>
          <GridCell width={90}>Price</GridCell>
          <GridCell width={110}>Amount ex GST</GridCell>
          <GridCell width={80}>GST</GridCell>
          <GridCell width={70}>Billable</GridCell>
          <GridCell width={70}>Billed</GridCell>
        </GridHeader>
        {rows.length === 0 ? (
          <EmptyPane>No disbursements recorded yet.</EmptyPane>
        ) : (
          rows.map((d) => (
            <GridRow key={d.id} className={cn(d.createdBySim && "bg-[#f2fbf4]")}>
              <GridCell width={90}>{formatAuDate(d.date)}</GridCell>
              <GridCell width={80}>{d.activityCode}</GridCell>
              <GridCell grow>{d.subject}</GridCell>
              <GridCell width={70} className="text-right">
                {d.quantity}
              </GridCell>
              <GridCell width={90} className="text-right">
                {formatMoney(d.price)}
              </GridCell>
              <GridCell width={110} className="text-right">
                {formatMoney(d.amountExGst)}
              </GridCell>
              <GridCell width={80} className="text-right">
                {formatMoney(d.gst)}
              </GridCell>
              <GridCell width={70}>{d.billable ? "Yes" : "No"}</GridCell>
              <GridCell width={70} className="text-[#2f7fd0]">
                {d.billedInvoice ?? "—"}
              </GridCell>
            </GridRow>
          ))
        )}
      </div>
    </div>
  );
}
