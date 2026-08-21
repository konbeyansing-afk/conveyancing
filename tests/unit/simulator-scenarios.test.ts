/**
 * Guided-scenario completability for the PEXA and Actionstep simulators, and
 * the structural invariants that apply to all 27 scenarios across all three.
 *
 * Same idea as the practice-system suite: drive the real reducer with the
 * actions the UI can dispatch, then assert each scenario's own `check`
 * predicate passes. A scenario whose checker can never be satisfied is a
 * trainee getting permanently stuck.
 */

import { describe, expect, it } from "vitest";
import { pexaReducer, type PexaAction } from "@/lib/pexa/store";
import { createPexaSeedState } from "@/lib/pexa/seed";
import { PEXA_GUIDED_TASKS } from "@/lib/pexa/guided-tasks";
import { fundsBalance, type PexaState } from "@/lib/pexa/types";

import { asReducer, type AsAction } from "@/lib/actionstep/store";
import { createAsSeedState } from "@/lib/actionstep/seed";
import { AS_GUIDED_TASKS } from "@/lib/actionstep/guided-tasks";
import { stepBlockers, stepsFor, type AsState } from "@/lib/actionstep/types";

import { GUIDED_TASKS } from "@/lib/simulator/guided-tasks";
import type { GuidedTask } from "@/lib/training/runner";

const BELTRAN_WS = "ws-1";
const RAGHUNATHAN_WS = "ws-2";
const AS_BELTRAN = "am-1";
const AS_RAGHUNATHAN = "am-2";
const AS_OKONKWO = "am-3";

function pexaRun(state: PexaState, ...actions: PexaAction[]): PexaState {
  return actions.reduce(pexaReducer, state);
}
function asRun(state: AsState, ...actions: AsAction[]): AsState {
  return actions.reduce(asReducer, state);
}

function assertActionSteps<T>(taskId: string, tasks: GuidedTask<T>[], state: T) {
  const t = tasks.find((x) => x.id === taskId);
  if (!t) throw new Error(`guided task ${taskId} not found`);
  const actionSteps = t.steps.filter((s) => s.kind === "action");
  expect(actionSteps.length).toBeGreaterThan(0);
  actionSteps.forEach((step, i) => {
    expect(
      step.check(state),
      `${taskId}: action step ${i + 1} not satisfied — "${step.instruction}"`,
    ).toBe(true);
  });
}

/* ================================================================== */
/* PEXA — 7 scenarios                                                  */
/* ================================================================== */

describe("PEXA — guided scenarios are completable", () => {
  it("px-read-status", () => {
    const state = pexaRun(createPexaSeedState(), {
      type: "OPEN_WORKSPACE",
      workspaceId: RAGHUNATHAN_WS,
    });
    assertActionSteps("px-read-status", PEXA_GUIDED_TASKS, state);
  });

  it("px-balance-fss", () => {
    let state = pexaRun(
      createPexaSeedState(),
      { type: "OPEN_WORKSPACE", workspaceId: RAGHUNATHAN_WS },
      { type: "SET_TAB", tab: "financial" },
    );
    const shortfall = fundsBalance(state.workspaces.find((w) => w.id === RAGHUNATHAN_WS)!);
    // The schedule is short on the destination side, so the fix is a destination line.
    expect(shortfall).toBeGreaterThan(0);
    state = pexaRun(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: RAGHUNATHAN_WS,
      direction: "Destination",
      category: "Rates adjustment",
      description: "Council rates adjustment to vendor",
      amount: shortfall,
    });
    assertActionSteps("px-balance-fss", PEXA_GUIDED_TASKS, state);
  });

  it("px-invite-participant", () => {
    const state = pexaRun(
      createPexaSeedState(),
      { type: "OPEN_WORKSPACE", workspaceId: BELTRAN_WS },
      { type: "SET_TAB", tab: "participants" },
      {
        type: "INVITE_PARTICIPANT",
        workspaceId: BELTRAN_WS,
        subscriberName: "Meridian Bank",
        role: "Incoming Mortgagee",
      },
    );
    assertActionSteps("px-invite-participant", PEXA_GUIDED_TASKS, state);
  });

  it("px-prepare-transfer", () => {
    let state = pexaRun(
      createPexaSeedState(),
      { type: "OPEN_WORKSPACE", workspaceId: BELTRAN_WS },
      { type: "SET_TAB", tab: "documents" },
    );
    for (const doc of state.workspaces.find((w) => w.id === BELTRAN_WS)!.documents) {
      state = pexaRun(state, {
        type: "SIGN_DOCUMENT",
        workspaceId: BELTRAN_WS,
        documentId: doc.id,
      });
    }
    assertActionSteps("px-prepare-transfer", PEXA_GUIDED_TASKS, state);
  });

  it("px-settlement-date", () => {
    const state = pexaRun(
      createPexaSeedState(),
      { type: "OPEN_WORKSPACE", workspaceId: BELTRAN_WS },
      { type: "SET_TAB", tab: "settlement" },
      {
        type: "PROPOSE_SETTLEMENT",
        workspaceId: BELTRAN_WS,
        date: "2026-09-04",
        time: "2:00 PM",
      },
      { type: "ACCEPT_SETTLEMENT", workspaceId: BELTRAN_WS },
    );
    assertActionSteps("px-settlement-date", PEXA_GUIDED_TASKS, state);
  });

  it("px-create-workspace", () => {
    let state = pexaRun(createPexaSeedState(), {
      type: "CREATE_WORKSPACE",
      draft: {
        jurisdiction: "NSW",
        titleReference: "12/SP84421",
        propertyAddress: "5/40 Ferndale Road, Epping NSW 2121",
        matterNumber: "004194",
        ourRole: "Incoming Proprietor",
        hasFinancialSettlement: true,
      },
    });
    const created = state.workspaces[0];
    state = pexaRun(
      state,
      {
        type: "INVITE_PARTICIPANT",
        workspaceId: created.id,
        subscriberName: "Kellner Property Law",
        role: "Proprietor on Title",
      },
      { type: "CREATE_DOCUMENT", workspaceId: created.id, documentType: "Transfer" },
    );
    assertActionSteps("px-create-workspace", PEXA_GUIDED_TASKS, state);
  });

  it("px-ready-ready", () => {
    let state = pexaRun(createPexaSeedState(), {
      type: "OPEN_WORKSPACE",
      workspaceId: RAGHUNATHAN_WS,
    });
    const shortfall = fundsBalance(state.workspaces.find((w) => w.id === RAGHUNATHAN_WS)!);
    state = pexaRun(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: RAGHUNATHAN_WS,
      direction: "Destination",
      category: "Rates adjustment",
      description: "Council rates adjustment to vendor",
      amount: shortfall,
    });
    state = pexaRun(state, { type: "SETTLE", workspaceId: RAGHUNATHAN_WS });
    assertActionSteps("px-ready-ready", PEXA_GUIDED_TASKS, state);
  });

  it("covers every PEXA scenario that ships", () => {
    expect(PEXA_GUIDED_TASKS).toHaveLength(7);
  });
});

/* ================================================================== */
/* Actionstep — 7 scenarios                                            */
/* ================================================================== */

/** Fills whatever the matter's current step still needs, so it can be left. */
function clearBlockers(state: AsState, matterId: string): AsState {
  const m = state.matters.find((x) => x.id === matterId)!;
  const step = stepsFor(state, m).find((s) => s.id === m.currentStepId);
  const blockers = stepBlockers(m, step);
  let next = state;
  for (const type of blockers.missingParticipantTypes) {
    next = asRun(next, {
      type: "ADD_PARTICIPANT",
      matterId,
      name: `Test ${type}`,
      participantType: type,
      email: "test@example.test",
      phone: "0000",
    });
  }
  for (const field of blockers.missingFields) {
    next = asRun(next, {
      type: "SET_DATA_FIELD",
      matterId,
      key: field.key,
      label: field.label,
      value: field.type === "date" ? "2026-08-20" : "Yes",
    });
  }
  return next;
}

describe("Actionstep — guided scenarios are completable", () => {
  it("as-read-step", () => {
    const state = asRun(
      createAsSeedState(),
      { type: "OPEN_MATTER", matterId: AS_BELTRAN },
      { type: "SET_TAB", tab: "steps" },
    );
    assertActionSteps("as-read-step", AS_GUIDED_TASKS, state);
  });

  it("as-unblock-step", () => {
    let state = asRun(createAsSeedState(), { type: "OPEN_MATTER", matterId: AS_BELTRAN });
    const settlement = stepsFor(state, state.matters.find((m) => m.id === AS_BELTRAN)!).find(
      (s) => s.name === "Settlement",
    )!;

    // Attempt the move first, so the trainee sees the block and it is logged.
    state = asRun(state, { type: "CHANGE_STEP", matterId: AS_BELTRAN, stepId: settlement.id });

    state = asRun(state, {
      type: "ADD_PARTICIPANT",
      matterId: AS_BELTRAN,
      name: "Meridian Bank",
      participantType: "Incoming Lender",
      email: "settlements@meridianbank.example",
      phone: "13 20 40",
    });
    state = asRun(
      state,
      {
        type: "SET_DATA_FIELD",
        matterId: AS_BELTRAN,
        key: "searchesComplete",
        label: "Searches complete",
        value: "Yes",
      },
      {
        type: "SET_DATA_FIELD",
        matterId: AS_BELTRAN,
        key: "adjustmentsPrepared",
        label: "Adjustments prepared",
        value: "Yes",
      },
    );
    state = clearBlockers(state, AS_BELTRAN);
    state = asRun(state, { type: "CHANGE_STEP", matterId: AS_BELTRAN, stepId: settlement.id });

    assertActionSteps("as-unblock-step", AS_GUIDED_TASKS, state);
  });

  it("as-file-note", () => {
    const state = asRun(
      createAsSeedState(),
      { type: "OPEN_MATTER", matterId: AS_RAGHUNATHAN },
      { type: "SET_TAB", tab: "filenotes" },
      {
        type: "ADD_FILE_NOTE",
        matterId: AS_RAGHUNATHAN,
        text: "Purchaser's agent asked for access to measure for blinds before settlement.",
      },
    );
    assertActionSteps("as-file-note", AS_GUIDED_TASKS, state);
  });

  it("as-step-history", () => {
    const state = asRun(
      createAsSeedState(),
      { type: "OPEN_MATTER", matterId: AS_RAGHUNATHAN },
      { type: "SET_TAB", tab: "steps" },
    );
    assertActionSteps("as-step-history", AS_GUIDED_TASKS, state);
  });

  it("as-create-matter", () => {
    const state = asRun(createAsSeedState(), {
      type: "CREATE_MATTER",
      draft: {
        name: "Ashcroft-Reyes — Purchase of 5/40 Ferndale Road, Epping",
        matterType: "Conveyancing — Purchase",
        clientName: "Dominic Ashcroft-Reyes",
        clientEmail: "d.ashcroft@example.test",
        clientPhone: "0400 000 000",
        assignedTo: "Shane Capati",
      },
    });
    assertActionSteps("as-create-matter", AS_GUIDED_TASKS, state);
  });

  it("as-record-time", () => {
    const state = asRun(
      createAsSeedState(),
      { type: "OPEN_MATTER", matterId: AS_BELTRAN },
      { type: "SET_TAB", tab: "time" },
      {
        type: "ADD_TIME_ENTRY",
        matterId: AS_BELTRAN,
        description: "Letter to clients confirming settlement booking",
        hours: 0.4,
        rate: 350,
        billable: true,
      },
    );
    assertActionSteps("as-record-time", AS_GUIDED_TASKS, state);
  });

  it("as-full-cycle", () => {
    let state = asRun(createAsSeedState(), { type: "OPEN_MATTER", matterId: AS_OKONKWO });
    const steps = stepsFor(state, state.matters.find((m) => m.id === AS_OKONKWO)!);
    const exchange = steps.find((s) => s.name === "Exchange")!;
    const preSettlement = steps.find((s) => s.name === "Pre-Settlement")!;

    state = asRun(state, {
      type: "ADD_PARTICIPANT",
      matterId: AS_OKONKWO,
      name: "Kellner Property Law",
      participantType: "Other Side Lawyer",
      email: "conveyancing@kellner.example",
      phone: "02 9000 0000",
    });
    state = clearBlockers(state, AS_OKONKWO);
    state = asRun(state, { type: "CHANGE_STEP", matterId: AS_OKONKWO, stepId: exchange.id });
    expect(state.matters.find((m) => m.id === AS_OKONKWO)!.currentStepId).toBe(exchange.id);

    state = clearBlockers(state, AS_OKONKWO);
    state = asRun(state, { type: "CHANGE_STEP", matterId: AS_OKONKWO, stepId: preSettlement.id });
    expect(state.matters.find((m) => m.id === AS_OKONKWO)!.currentStepId).toBe(preSettlement.id);

    assertActionSteps("as-full-cycle", AS_GUIDED_TASKS, state);
  });

  it("covers every Actionstep scenario that ships", () => {
    expect(AS_GUIDED_TASKS).toHaveLength(7);
  });
});

/* ================================================================== */
/* Structural invariants across all 27 scenarios                       */
/* ================================================================== */

const ALL_SCENARIOS: { simulator: string; tasks: GuidedTask<never>[] }[] = [
  { simulator: "practice-system", tasks: GUIDED_TASKS as unknown as GuidedTask<never>[] },
  { simulator: "pexa", tasks: PEXA_GUIDED_TASKS as unknown as GuidedTask<never>[] },
  { simulator: "actionstep", tasks: AS_GUIDED_TASKS as unknown as GuidedTask<never>[] },
];

describe("Guided training engine — scenario definitions are well formed", () => {
  it("ships 27 scenarios in total", () => {
    expect(ALL_SCENARIOS.reduce((n, s) => n + s.tasks.length, 0)).toBe(27);
  });

  it("uses globally unique scenario ids", () => {
    const ids = ALL_SCENARIOS.flatMap((s) => s.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const { simulator, tasks } of ALL_SCENARIOS) {
    describe(simulator, () => {
      it("gives every scenario a title, brief, summary and skills", () => {
        for (const t of tasks) {
          expect(t.title.trim(), t.id).not.toBe("");
          expect(t.brief.trim().length, t.id).toBeGreaterThan(20);
          expect(t.summary.trim(), t.id).not.toBe("");
          expect(t.skills.length, t.id).toBeGreaterThan(0);
          expect(t.minutes, t.id).toBeGreaterThan(0);
        }
      });

      it("gives every step an instruction and a hint", () => {
        for (const t of tasks) {
          expect(t.steps.length, t.id).toBeGreaterThan(0);
          t.steps.forEach((step, i) => {
            expect(step.instruction.trim(), `${t.id} step ${i + 1}`).not.toBe("");
            expect(step.hint.trim(), `${t.id} step ${i + 1}`).not.toBe("");
          });
        }
      });

      it("gives every answer step a correct option that exists, plus an explanation", () => {
        for (const t of tasks) {
          for (const step of t.steps) {
            if (step.kind !== "answer") continue;
            expect(step.options.length, `${t.id}: "${step.question}"`).toBeGreaterThanOrEqual(2);
            expect(step.correct, `${t.id}: "${step.question}"`).toBeGreaterThanOrEqual(0);
            expect(step.correct, `${t.id}: "${step.question}"`).toBeLessThan(step.options.length);
            expect(step.explanation.trim(), `${t.id}: "${step.question}"`).not.toBe("");
            expect(new Set(step.options).size, `${t.id}: duplicate options`).toBe(
              step.options.length,
            );
            for (const option of step.options) expect(option.trim()).not.toBe("");
          }
        }
      });

      it("contains at least one action step per scenario", () => {
        for (const t of tasks) {
          expect(t.steps.some((s) => s.kind === "action"), t.id).toBe(true);
        }
      });

      it("does not put the correct answer in the same slot every time", () => {
        // A scenario set where the answer is always option A teaches position, not content.
        const positions = tasks.flatMap((t) =>
          t.steps.filter((s) => s.kind === "answer").map((s) => s.correct),
        );
        if (positions.length >= 3) expect(new Set(positions).size).toBeGreaterThan(1);
      });
    });
  }
});
