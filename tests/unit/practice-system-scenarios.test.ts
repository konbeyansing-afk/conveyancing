/**
 * Every guided scenario in the practice-management simulator is driven through
 * the real reducer here, and each action step's own `check` predicate is
 * asserted. If a scenario's checker can never be satisfied by the actions the
 * UI can dispatch, this fails — which is the failure a trainee would otherwise
 * discover by getting stuck halfway through a task.
 */

import { describe, expect, it } from "vitest";
import { simReducer, type NewMatterDraft, type SimAction } from "@/lib/simulator/store";
import { createSeedState, SIM_TODAY } from "@/lib/simulator/seed";
import { GUIDED_TASKS, getGuidedTask, type SimGuidedTask } from "@/lib/simulator/guided-tasks";
import type { SimState } from "@/lib/simulator/types";

const BELTRAN = "m-4182";
const RAGHUNATHAN = "m-4176";

function run(state: SimState, ...actions: SimAction[]): SimState {
  return actions.reduce(simReducer, state);
}

function task(id: string): SimGuidedTask {
  const found = getGuidedTask(id);
  if (!found) throw new Error(`guided task ${id} not found`);
  return found;
}

/**
 * Applies the given actions, then asserts every action step of the scenario is
 * satisfied. Answer steps have no state predicate, so they are checked
 * separately (see the "answer steps" block below).
 */
function expectScenarioSatisfied(taskId: string, actions: SimAction[]) {
  const t = task(taskId);
  const state = run(createSeedState(), ...actions);
  const actionSteps = t.steps.filter((s) => s.kind === "action");
  expect(actionSteps.length).toBeGreaterThan(0);
  actionSteps.forEach((step, i) => {
    expect(
      step.check(state),
      `${taskId}: action step ${i + 1} not satisfied — "${step.instruction}"`,
    ).toBe(true);
  });
  return state;
}

const newMatterDraft = (over: Partial<NewMatterDraft> = {}): NewMatterDraft => ({
  state: "NSW",
  areaOfLaw: "Conveyancing",
  type: "Purchase",
  clientName: "Dominic Ashcroft-Reyes",
  clientRole: "Purchaser",
  clientEmail: "d.ashcroft@example.test",
  clientPhone: "0400 000 000",
  otherPartyName: "Marguerite Salvatierra",
  otherPartySolicitor: "Kellner Property Law",
  riskRating: "Medium",
  amlComplete: false,
  internalReference: "",
  reLine: "Purchase of 5/40 Ferndale Road",
  matterDescription: "",
  matterOpened: SIM_TODAY,
  propertyAddress: "5/40 Ferndale Road, Epping NSW 2121",
  titleReference: "",
  purchasePrice: "",
  settlementDate: "",
  personResponsible: "Jennie Tonner",
  personAssisting: "",
  introducer: "",
  referralType: "",
  referrer: "",
  debtor: "",
  billingType: "Fixed Fee",
  feeEstimate: "",
  billingUnits: "6 minute units",
  billingFrequency: "On completion",
  hourlyRate: "",
  ...over,
});

/* ------------------------------------------------------------------ */
/* The 13 scenarios                                                    */
/* ------------------------------------------------------------------ */

describe("Practice System — guided scenarios are completable", () => {
  it("gt-find-settlement", () => {
    expectScenarioSatisfied("gt-find-settlement", [
      { type: "NAV_RAIL", rail: "matters" },
      { type: "OPEN_MATTER", matterId: BELTRAN },
    ]);
  });

  it("gt-file-note", () => {
    expectScenarioSatisfied("gt-file-note", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      { type: "MATTER_TAB", tab: "memos" },
      {
        type: "ADD_MEMO",
        matterId: BELTRAN,
        title: "19/08/2026 — call from other side's assistant",
        body: "Shed key and remote will be left with the agent rather than handed over at settlement.",
      },
    ]);
  });

  it("gt-time-entry", () => {
    expectScenarioSatisfied("gt-time-entry", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      { type: "MATTER_TAB", tab: "time" },
      {
        type: "ADD_TIME_ENTRY",
        entry: {
          matterId: BELTRAN,
          date: SIM_TODAY,
          staff: "Shane Capati",
          activityCode: "TELEP",
          subject: "Call with Ridgeline Finance re loan approval",
          billingMode: "Hrs",
          hours: 0.3,
          rate: 350,
          amountExGst: Math.round(0.3 * 350 * 100) / 100,
          gst: Math.round(0.3 * 350 * 10) / 100,
          billable: true,
          billedInvoice: null,
        },
      },
    ]);
  });

  it("gt-disbursement", () => {
    expectScenarioSatisfied("gt-disbursement", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      { type: "MATTER_TAB", tab: "time" },
      { type: "NAV_TIME_SUBTAB", subTab: "disbursements" },
      {
        type: "ADD_DISBURSEMENT",
        entry: {
          matterId: BELTRAN,
          date: SIM_TODAY,
          staff: "Shane Capati",
          activityCode: "COUNC",
          subject: "Council rates certificate",
          quantity: 1,
          price: 99,
          amountExGst: 90,
          gst: 9,
          gstInclusive: true,
          billable: true,
          billedInvoice: null,
        },
      },
    ]);
  });

  it("gt-clear-task", () => {
    const seed = createSeedState();
    const financierTask = seed.tasks.find(
      (t) => t.matterId === BELTRAN && /financier/i.test(t.name),
    );
    expect(financierTask, "seed must contain the Beltran financier task").toBeDefined();

    expectScenarioSatisfied("gt-clear-task", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      { type: "MATTER_TAB", tab: "emails" },
      { type: "MATTER_TAB", tab: "tasks" },
      { type: "TOGGLE_TASK", taskId: financierTask!.id },
      {
        type: "ADD_MEMO",
        matterId: BELTRAN,
        title: "Loan approval — Ridgeline Finance",
        body: "Broker confirms the loan is approved; financier details to follow.",
      },
    ]);
  });

  it("gt-create-matter", () => {
    expectScenarioSatisfied("gt-create-matter", [
      { type: "OPEN_CREATE_MATTER" },
      { type: "CREATE_MATTER", draft: newMatterDraft() },
    ]);
  });

  it("gt-daily-triage", () => {
    expectScenarioSatisfied("gt-daily-triage", [
      { type: "NAV_RAIL", rail: "tasks" },
      { type: "OPEN_MATTER", matterId: RAGHUNATHAN },
    ]);
  });

  it("gt-phone-message", () => {
    expectScenarioSatisfied("gt-phone-message", [
      {
        type: "ADD_PHONE_MESSAGE",
        matterId: RAGHUNATHAN,
        caller: "Marcus Delacourt",
        callerPhone: "02 9412 6600",
        summary: "Still waiting on our adjustment figures; settlement 27 August. Wants a call back today.",
        forStaff: "Jennie Tonner",
      },
      { type: "OPEN_MATTER", matterId: RAGHUNATHAN },
      {
        type: "ADD_TASK",
        matterId: RAGHUNATHAN,
        name: "Send adjustment figures to Delacourt & Vine",
        dueOn: SIM_TODAY,
        category: "Pre-Settlement",
        priority: "Urgent",
      },
    ]);
  });

  it("gt-convert-lead", () => {
    expectScenarioSatisfied("gt-convert-lead", [
      { type: "OPEN_LEAD", leadId: "l-1" },
      { type: "CONVERT_LEAD", leadId: "l-1" },
    ]);
  });

  it("gt-apply-workflow", () => {
    const seed = createSeedState();
    const saleWorkflow = seed.workflows.find((w) => /sale/i.test(w.name));
    expect(saleWorkflow, "seed must contain a Sale workflow").toBeDefined();

    expectScenarioSatisfied("gt-apply-workflow", [
      { type: "OPEN_MATTER", matterId: RAGHUNATHAN },
      { type: "MATTER_TAB", tab: "tasks" },
      { type: "APPLY_WORKFLOW", matterId: RAGHUNATHAN, workflowId: saleWorkflow!.id },
    ]);
  });

  it("gt-fix-matter-details", () => {
    expectScenarioSatisfied("gt-fix-matter-details", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      {
        type: "UPDATE_MATTER",
        matterId: BELTRAN,
        patch: { personResponsible: "Jennie Tonner" },
        section: "Matter Info",
      },
    ]);
  });

  it("gt-client-email", () => {
    expectScenarioSatisfied("gt-client-email", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      { type: "MATTER_TAB", tab: "emails" },
      {
        type: "ADD_EMAIL",
        matterId: BELTRAN,
        to: "amara.beltran@examplemail.com",
        subject: "Update on your purchase — settlement 4 September",
        body: "Searches are back and contracts are exchanged. Settlement remains 4 September 2026. Your question about the finance condition has been referred to the fee earner.",
      },
    ]);
  });

  it("gt-precedent-letter", () => {
    expectScenarioSatisfied("gt-precedent-letter", [
      { type: "OPEN_MATTER", matterId: BELTRAN },
      {
        type: "ADD_DOCUMENT",
        matterId: BELTRAN,
        name: "Letter to client — post exchange",
        source: "Precedent",
      },
      { type: "MATTER_TAB", tab: "time" },
      {
        type: "ADD_TIME_ENTRY",
        entry: {
          matterId: BELTRAN,
          date: SIM_TODAY,
          staff: "Shane Capati",
          activityCode: "LETTE",
          subject: "Post-exchange letter to client",
          billingMode: "Hrs",
          hours: 0.2,
          rate: 350,
          amountExGst: Math.round(0.2 * 350 * 100) / 100,
          gst: Math.round(0.2 * 350 * 10) / 100,
          billable: true,
          billedInvoice: null,
        },
      },
    ]);
  });

  it("covers every scenario the simulator ships", () => {
    // Guards against a new scenario being added without a completability test.
    expect(GUIDED_TASKS).toHaveLength(13);
  });
});

/* ------------------------------------------------------------------ */
/* Negative cases — a checker must not pass for the wrong action       */
/* ------------------------------------------------------------------ */

describe("Practice System — scenario checks reject the wrong action", () => {
  it("does not accept a time entry on the wrong matter", () => {
    const t = task("gt-time-entry");
    const step = t.steps.filter((s) => s.kind === "action").at(-1)!;
    const state = run(
      createSeedState(),
      { type: "OPEN_MATTER", matterId: BELTRAN },
      { type: "MATTER_TAB", tab: "time" },
      {
        type: "ADD_TIME_ENTRY",
        entry: {
          matterId: RAGHUNATHAN,
          date: SIM_TODAY,
          staff: "Shane Capati",
          activityCode: "TELEP",
          subject: "Call",
          billingMode: "Hrs",
          hours: 0.3,
          rate: 350,
          amountExGst: Math.round(0.3 * 350 * 100) / 100,
          gst: Math.round(0.3 * 350 * 10) / 100,
          billable: true,
          billedInvoice: null,
        },
      },
    );
    expect(step.check(state)).toBe(false);
  });

  it("does not accept a non-billable time entry", () => {
    const step = task("gt-time-entry").steps.filter((s) => s.kind === "action").at(-1)!;
    const state = run(createSeedState(), {
      type: "ADD_TIME_ENTRY",
      entry: {
        matterId: BELTRAN,
        date: SIM_TODAY,
        staff: "Shane Capati",
        activityCode: "TELEP",
        subject: "Call",
        billingMode: "Hrs",
        hours: 0.3,
        rate: 350,
        amountExGst: Math.round(0.3 * 350 * 100) / 100,
        gst: Math.round(0.3 * 350 * 10) / 100,
        billable: false,
        billedInvoice: null,
      },
    });
    expect(step.check(state)).toBe(false);
  });

  it("does not accept the wrong activity code", () => {
    const step = task("gt-time-entry").steps.filter((s) => s.kind === "action").at(-1)!;
    const state = run(createSeedState(), {
      type: "ADD_TIME_ENTRY",
      entry: {
        matterId: BELTRAN,
        date: SIM_TODAY,
        staff: "Shane Capati",
        activityCode: "LETTE",
        subject: "Call",
        billingMode: "Hrs",
        hours: 0.3,
        rate: 350,
        amountExGst: Math.round(0.3 * 350 * 100) / 100,
        gst: Math.round(0.3 * 350 * 10) / 100,
        billable: true,
        billedInvoice: null,
      },
    });
    expect(step.check(state)).toBe(false);
  });

  it("does not accept 18 recorded as 18 hours instead of 0.3", () => {
    const step = task("gt-time-entry").steps.filter((s) => s.kind === "action").at(-1)!;
    const state = run(createSeedState(), {
      type: "ADD_TIME_ENTRY",
      entry: {
        matterId: BELTRAN,
        date: SIM_TODAY,
        staff: "Shane Capati",
        activityCode: "TELEP",
        subject: "Call",
        billingMode: "Hrs",
        hours: 18,
        rate: 350,
        amountExGst: Math.round(18 * 350 * 100) / 100,
        gst: Math.round(18 * 350 * 10) / 100,
        billable: true,
        billedInvoice: null,
      },
    });
    expect(step.check(state)).toBe(false);
  });

  it("does not accept a memo that misses the substance of the call", () => {
    const step = task("gt-file-note").steps.filter((s) => s.kind === "action").at(-1)!;
    const state = run(createSeedState(), {
      type: "ADD_MEMO",
      matterId: BELTRAN,
      title: "Call",
      body: "Spoke to the other side.",
    });
    expect(step.check(state)).toBe(false);
  });

  it("does not accept a new matter with AML ticked when no ID was sighted", () => {
    const t = task("gt-create-matter");
    const amlStep = t.steps.filter((s) => s.kind === "action").at(-1)!;
    const state = run(
      createSeedState(),
      { type: "OPEN_CREATE_MATTER" },
      { type: "CREATE_MATTER", draft: newMatterDraft({ amlComplete: true }) },
    );
    expect(amlStep.check(state)).toBe(false);
  });

  it("does not accept merely opening a matter as having done the work", () => {
    const state = run(createSeedState(), { type: "OPEN_MATTER", matterId: BELTRAN });
    for (const t of GUIDED_TASKS) {
      const doingSteps = t.steps.filter(
        (s) => s.kind === "action" && !/^open |^go to |^work out/i.test(s.instruction),
      );
      const anySatisfied = doingSteps.some((s) => s.kind === "action" && s.check(state));
      expect(anySatisfied, `${t.id} passes a doing-step without the trainee doing anything`).toBe(
        false,
      );
    }
  });
});
