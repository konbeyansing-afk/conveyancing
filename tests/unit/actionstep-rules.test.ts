/**
 * Actionstep simulator rules.
 *
 * Actionstep's whole point as a training environment is that the workflow
 * enforces the process: you cannot leave a step until its required
 * participants and data fields are filled in, entering a step raises that
 * step's tasks, and step history records how long the matter sat where.
 */

import { describe, expect, it } from "vitest";
import { asReducer, type AsAction } from "@/lib/actionstep/store";
import { AS_TODAY, createAsSeedState } from "@/lib/actionstep/seed";
import {
  canLeaveStep,
  currentStep,
  daysInStep,
  stepBlockers,
  stepsFor,
  type AsMatter,
  type AsState,
} from "@/lib/actionstep/types";

function run(state: AsState, ...actions: AsAction[]): AsState {
  return actions.reduce(asReducer, state);
}

function matter(state: AsState, id: string): AsMatter {
  const found = state.matters.find((m) => m.id === id);
  if (!found) throw new Error(`matter ${id} not found`);
  return found;
}

describe("Actionstep — blocked step transitions", () => {
  it("reports exactly what the blocked Beltran matter is missing", () => {
    const state = createAsSeedState();
    const m = matter(state, "am-1");
    const step = currentStep(state, m);
    expect(step?.name).toBe("Pre-Settlement");

    const blockers = stepBlockers(m, step);
    expect(blockers.missingParticipantTypes).toContain("Incoming Lender");
    expect(blockers.missingFields.length).toBeGreaterThan(0);
    expect(canLeaveStep(m, step)).toBe(false);
  });

  it("refuses to move the matter and logs why", () => {
    const state = createAsSeedState();
    const before = matter(state, "am-1");
    const steps = stepsFor(state, before);
    const target = steps.find((s) => s.name === "Settlement")!;

    const after = run(state, { type: "CHANGE_STEP", matterId: "am-1", stepId: target.id });

    // The matter has not moved.
    expect(matter(after, "am-1").currentStepId).toBe(before.currentStepId);
    // No history entry was opened or closed.
    expect(matter(after, "am-1").stepHistory).toEqual(before.stepHistory);
    // No tasks were raised for a step that was never entered.
    expect(after.tasks).toHaveLength(state.tasks.length);

    const blocked = after.log.filter((l) => l.type === "step.blocked");
    expect(blocked).toHaveLength(1);
    expect(blocked[0].detail.missingParticipants).toContain("Incoming Lender");
    expect(String(blocked[0].detail.missingFields ?? "")).not.toBe("");
  });

  it("lets the matter move once the blockers are cleared", () => {
    let state = createAsSeedState();
    const steps = stepsFor(state, matter(state, "am-1"));
    const preSettlement = steps.find((s) => s.name === "Pre-Settlement")!;
    const settlement = steps.find((s) => s.name === "Settlement")!;

    state = run(state, {
      type: "ADD_PARTICIPANT",
      matterId: "am-1",
      name: "Ridgeline Finance",
      participantType: "Incoming Lender",
      email: "settlements@ridgeline.example",
      phone: "13 00 00",
    });
    for (const field of preSettlement.dataFields.filter((f) => f.required)) {
      state = run(state, {
        type: "SET_DATA_FIELD",
        matterId: "am-1",
        key: field.key,
        label: field.label,
        value: field.type === "date" ? "2026-09-01" : "1000",
      });
    }

    expect(canLeaveStep(matter(state, "am-1"), preSettlement)).toBe(true);

    const tasksBefore = state.tasks.length;
    state = run(state, { type: "CHANGE_STEP", matterId: "am-1", stepId: settlement.id });

    expect(matter(state, "am-1").currentStepId).toBe(settlement.id);
    // Entering a step raises that step's tasks.
    expect(state.tasks.length).toBe(tasksBefore + settlement.tasks.length);
    for (const name of settlement.tasks) {
      expect(state.tasks.some((t) => t.matterId === "am-1" && t.name === name)).toBe(true);
    }
  });

  it("treats a whitespace-only answer as still missing", () => {
    let state = createAsSeedState();
    const steps = stepsFor(state, matter(state, "am-1"));
    const preSettlement = steps.find((s) => s.name === "Pre-Settlement")!;
    const required = preSettlement.dataFields.filter((f) => f.required);

    state = run(state, {
      type: "ADD_PARTICIPANT",
      matterId: "am-1",
      name: "Ridgeline Finance",
      participantType: "Incoming Lender",
      email: "settlements@ridgeline.example",
      phone: "13 00 00",
    });
    for (const field of required) {
      state = run(state, {
        type: "SET_DATA_FIELD",
        matterId: "am-1",
        key: field.key,
        label: field.label,
        value: "   ",
      });
    }
    expect(canLeaveStep(matter(state, "am-1"), preSettlement)).toBe(false);
    expect(stepBlockers(matter(state, "am-1"), preSettlement).missingFields).toHaveLength(
      required.length,
    );
  });

  it("ignores a change to a step that does not exist", () => {
    const state = createAsSeedState();
    const after = run(state, { type: "CHANGE_STEP", matterId: "am-2", stepId: "not-a-step" });
    expect(after).toEqual(state);
  });

  it("ignores a change on a matter that does not exist", () => {
    const state = createAsSeedState();
    const after = run(state, { type: "CHANGE_STEP", matterId: "not-a-matter", stepId: "p-2" });
    expect(after).toEqual(state);
  });
});

describe("Actionstep — step history and days in step", () => {
  it("closes the old history entry and opens a new one on a legal move", () => {
    let state = createAsSeedState();
    const m = matter(state, "am-2");
    const steps = stepsFor(state, m);
    const preSettlement = steps.find((s) => s.id === m.currentStepId)!;
    const settlement = steps.find((s) => s.name === "Settlement")!;

    // Clear whatever the Sale Pre-Settlement step still needs.
    for (const field of preSettlement.dataFields.filter((f) => f.required)) {
      state = run(state, {
        type: "SET_DATA_FIELD",
        matterId: "am-2",
        key: field.key,
        label: field.label,
        value: "2026-08-20",
      });
    }
    for (const type of stepBlockers(matter(state, "am-2"), preSettlement).missingParticipantTypes) {
      state = run(state, {
        type: "ADD_PARTICIPANT",
        matterId: "am-2",
        name: `Test ${type}`,
        participantType: type,
        email: "test@example.test",
        phone: "0000",
      });
    }

    const historyBefore = matter(state, "am-2").stepHistory.length;
    state = run(state, { type: "CHANGE_STEP", matterId: "am-2", stepId: settlement.id });
    const history = matter(state, "am-2").stepHistory;

    expect(history).toHaveLength(historyBefore + 1);
    expect(history.filter((h) => h.exitedAt === null)).toHaveLength(1);
    expect(history.at(-1)!.stepId).toBe(settlement.id);
    expect(history.at(-1)!.enteredAt).toBe(AS_TODAY);
    expect(history.at(-2)!.exitedAt).toBe(AS_TODAY);
  });

  it("counts whole days between entering and exiting a step", () => {
    expect(daysInStep({ id: "x", stepId: "s", enteredAt: "2026-08-01", exitedAt: "2026-08-09" }, AS_TODAY)).toBe(8);
  });

  it("counts an open step up to today", () => {
    expect(daysInStep({ id: "x", stepId: "s", enteredAt: "2026-08-11", exitedAt: null }, "2026-08-19")).toBe(8);
  });

  it("never returns a negative number of days", () => {
    expect(daysInStep({ id: "x", stepId: "s", enteredAt: "2026-08-19", exitedAt: "2026-08-01" }, AS_TODAY)).toBe(0);
  });

  it("returns zero for an unparseable date rather than NaN", () => {
    expect(daysInStep({ id: "x", stepId: "s", enteredAt: "not-a-date", exitedAt: null }, AS_TODAY)).toBe(0);
  });
});

describe("Actionstep — matter creation", () => {
  it("starts a new matter at the first workflow step and raises its tasks", () => {
    const state = run(createAsSeedState(), {
      type: "CREATE_MATTER",
      draft: {
        name: "Test Client — Purchase of 1 Test Street",
        matterType: "Conveyancing — Purchase",
        clientName: "Test Client",
        clientEmail: "test.client@example.test",
        clientPhone: "0400 000 000",
        assignedTo: "Shane Capati",
      },
    });
    const created = state.matters[0];
    const first = stepsFor(state, created)[0];

    expect(created.currentStepId).toBe(first.id);
    expect(created.stepHistory).toHaveLength(1);
    expect(created.stepHistory[0].exitedAt).toBeNull();
    expect(created.participants.map((p) => p.participantType)).toContain("Client");

    const raised = state.tasks.filter((t) => t.matterId === created.id);
    expect(raised.map((t) => t.name).sort()).toEqual([...first.tasks].sort());
  });

  it("gives the new matter the next action id", () => {
    const state = createAsSeedState();
    const highest = Math.max(...state.matters.map((m) => m.actionId));
    const after = run(state, {
      type: "CREATE_MATTER",
      draft: {
        name: "Test Client — Sale",
        matterType: "Conveyancing — Sale",
        clientName: "Test Client",
        clientEmail: "test.client@example.test",
        clientPhone: "0400 000 000",
        assignedTo: "Shane Capati",
      },
    });
    expect(after.matters[0].actionId).toBe(highest + 1);
  });

  it("cannot start a new matter already past its first step", () => {
    const state = run(createAsSeedState(), {
      type: "CREATE_MATTER",
      draft: {
        name: "Test Client — Purchase",
        matterType: "Conveyancing — Purchase",
        clientName: "Test Client",
        clientEmail: "test.client@example.test",
        clientPhone: "0400 000 000",
        assignedTo: "Shane Capati",
      },
    });
    const created = state.matters[0];
    const steps = stepsFor(state, created);
    const later = steps.find((s) => s.name === "Exchange")!;
    const blocked = run(state, { type: "CHANGE_STEP", matterId: created.id, stepId: later.id });
    // The first step needs its client data before the matter can leave it.
    expect(matter(blocked, created.id).currentStepId).toBe(created.currentStepId);
  });
});

describe("Actionstep — tasks, file notes and time", () => {
  it("completes and re-opens a task", () => {
    let state = createAsSeedState();
    const task = state.tasks[0];
    expect(task.completedOn).toBeNull();

    state = run(state, { type: "TOGGLE_TASK", taskId: task.id });
    expect(state.tasks.find((t) => t.id === task.id)!.completedOn).toBe(AS_TODAY);

    state = run(state, { type: "TOGGLE_TASK", taskId: task.id });
    expect(state.tasks.find((t) => t.id === task.id)!.completedOn).toBeNull();
  });

  it("ignores toggling a task that does not exist", () => {
    const state = createAsSeedState();
    expect(run(state, { type: "TOGGLE_TASK", taskId: "nope" })).toEqual(state);
  });

  it("records a file note against the matter with the signed-in author", () => {
    const state = run(createAsSeedState(), {
      type: "ADD_FILE_NOTE",
      matterId: "am-1",
      text: "Called the client to confirm the lender.",
    });
    const note = state.fileNotes[0];
    expect(note.matterId).toBe("am-1");
    expect(note.author).toBe(state.user.name);
    expect(note.createdAt).toBe(AS_TODAY);
  });

  it("records a billable time entry", () => {
    const state = run(createAsSeedState(), {
      type: "ADD_TIME_ENTRY",
      matterId: "am-1",
      description: "Review of adjustment figures",
      hours: 0.5,
      rate: 350,
      billable: true,
    });
    const entry = state.timeEntries[0];
    expect(entry.matterId).toBe("am-1");
    expect(entry.hours).toBe(0.5);
    expect(entry.billable).toBe(true);
  });

  it("returns a clean seed on RESET", () => {
    let state = run(createAsSeedState(), {
      type: "ADD_FILE_NOTE",
      matterId: "am-1",
      text: "scratch",
    });
    state = run(state, { type: "RESET" });
    expect(state.fileNotes).toEqual(createAsSeedState().fileNotes);
    expect(state.log).toHaveLength(0);
  });
});
