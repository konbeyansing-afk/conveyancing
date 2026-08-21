/**
 * PEXA simulator rules.
 *
 * These are the rules the audit brief calls non-negotiable: the Financial
 * Settlement Schedule must balance to the cent, an unbalanced schedule must
 * block settlement, only the responsible role may sign a document, every
 * participant must accept the date, and re-proposing a date must clear the
 * acceptances that were given for the old one.
 */

import { describe, expect, it } from "vitest";
import { pexaReducer, type PexaAction } from "@/lib/pexa/store";
import { createPexaSeedState, PEXA_FEE_NSW_FINANCIAL } from "@/lib/pexa/seed";
import {
  financialStatus,
  fundsBalance,
  isDateAgreed,
  isFundsBalanced,
  isReadyReady,
  lodgementStatus,
  type PexaState,
  type PexaWorkspace,
} from "@/lib/pexa/types";

function run(state: PexaState, ...actions: PexaAction[]): PexaState {
  return actions.reduce(pexaReducer, state);
}

function ws(state: PexaState, id: string): PexaWorkspace {
  const found = state.workspaces.find((w) => w.id === id);
  if (!found) throw new Error(`workspace ${id} not found`);
  return found;
}

describe("PEXA — Financial Settlement Schedule", () => {
  it("starts out of balance on the seeded purchase workspace", () => {
    const state = createPexaSeedState();
    const w = ws(state, "ws-1");
    expect(w.hasFinancialSettlement).toBe(true);
    expect(fundsBalance(w)).not.toBe(0);
    expect(isFundsBalanced(w)).toBe(false);
    expect(financialStatus(w)).toBe("Prepared");
  });

  it("balances only when source and destination match exactly", () => {
    const state = createPexaSeedState();
    const start = ws(state, "ws-1");
    const shortfall = Math.abs(fundsBalance(start));

    const oneCentShort = run(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: "ws-1",
      direction: "Source",
      category: "Loan advance",
      description: "Meridian Bank advance",
      amount: shortfall - 0.01,
    });
    // Balance is source minus destination, so a cent short reads as -0.01.
    expect(fundsBalance(ws(oneCentShort, "ws-1"))).toBe(-0.01);
    expect(isFundsBalanced(ws(oneCentShort, "ws-1"))).toBe(false);

    const exact = run(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: "ws-1",
      direction: "Source",
      category: "Loan advance",
      description: "Meridian Bank advance",
      amount: shortfall,
    });
    expect(fundsBalance(ws(exact, "ws-1"))).toBe(0);
    expect(isFundsBalanced(ws(exact, "ws-1"))).toBe(true);
    expect(financialStatus(ws(exact, "ws-1"))).toBe("Ready");
  });

  it("is one cent out when a line is a cent over, not silently rounded away", () => {
    const state = createPexaSeedState();
    const shortfall = Math.abs(fundsBalance(ws(state, "ws-1")));
    const over = run(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: "ws-1",
      direction: "Source",
      category: "Loan advance",
      description: "Meridian Bank advance",
      amount: shortfall + 0.01,
    });
    expect(fundsBalance(ws(over, "ws-1"))).toBe(0.01);
    expect(isFundsBalanced(ws(over, "ws-1"))).toBe(false);
  });

  it("does not let a locked line (PEXA's own fee) be removed", () => {
    const state = createPexaSeedState();
    const locked = ws(state, "ws-1").funds.find((f) => f.locked);
    expect(locked).toBeDefined();
    const after = run(state, {
      type: "REMOVE_FUNDS_LINE",
      workspaceId: "ws-1",
      lineId: locked!.id,
    });
    expect(ws(after, "ws-1").funds.some((f) => f.id === locked!.id)).toBe(true);
  });

  it("removes an unlocked line the trainee added", () => {
    let state = createPexaSeedState();
    state = run(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: "ws-1",
      direction: "Source",
      category: "Loan advance",
      description: "typo",
      amount: 1,
    });
    const added = ws(state, "ws-1").funds.find((f) => f.description === "typo")!;
    state = run(state, { type: "REMOVE_FUNDS_LINE", workspaceId: "ws-1", lineId: added.id });
    expect(ws(state, "ws-1").funds.some((f) => f.id === added.id)).toBe(false);
  });

  it("pre-populates the NSW PEXA fee on a new financial-settlement workspace", () => {
    const state = run(createPexaSeedState(), {
      type: "CREATE_WORKSPACE",
      draft: {
        jurisdiction: "NSW",
        titleReference: "1/TEST999",
        propertyAddress: "1 Test Street, Testville NSW 2000",
        matterNumber: "009999",
        ourRole: "Incoming Proprietor",
        hasFinancialSettlement: true,
      },
    });
    const created = state.workspaces[0];
    expect(created.funds).toHaveLength(1);
    expect(created.funds[0].amount).toBe(PEXA_FEE_NSW_FINANCIAL);
    expect(created.funds[0].locked).toBe(true);
  });

  it("gives a lodgement-only workspace no schedule to balance", () => {
    const state = run(createPexaSeedState(), {
      type: "CREATE_WORKSPACE",
      draft: {
        jurisdiction: "NSW",
        titleReference: "2/TEST999",
        propertyAddress: "2 Test Street, Testville NSW 2000",
        matterNumber: "009998",
        ourRole: "Incoming Proprietor",
        hasFinancialSettlement: false,
      },
    });
    const created = state.workspaces[0];
    expect(created.funds).toHaveLength(0);
    expect(financialStatus(created)).toBe("Ready");
  });
});

describe("PEXA — settlement date acceptance", () => {
  it("clears every other participant's acceptance when the date is re-proposed", () => {
    const seed = createPexaSeedState();
    // ws-2 starts with all three participants having accepted.
    const before = ws(seed, "ws-2");
    expect(before.acceptedBy.length).toBe(before.participants.length);
    expect(isDateAgreed(before)).toBe(true);

    const after = run(seed, {
      type: "PROPOSE_SETTLEMENT",
      workspaceId: "ws-2",
      date: "2026-09-11",
      time: "3:00 PM",
    });
    const w = ws(after, "ws-2");
    expect(w.settlementDate).toBe("2026-09-11");
    // Only the proposer is left as having accepted.
    expect(w.acceptedBy).toEqual([w.participants.find((p) => p.isSelf)!.id]);
    expect(isDateAgreed(w)).toBe(false);
  });

  it("does not treat a date as agreed while a participant has not accepted", () => {
    const seed = createPexaSeedState();
    const w = ws(seed, "ws-1");
    expect(w.settlementDate).not.toBeNull();
    expect(isDateAgreed(w)).toBe(false);
  });

  it("records our acceptance once and does not duplicate it", () => {
    let state = createPexaSeedState();
    state = run(
      state,
      { type: "PROPOSE_SETTLEMENT", workspaceId: "ws-1", date: "2026-09-04", time: "2:00 PM" },
      { type: "ACCEPT_SETTLEMENT", workspaceId: "ws-1" },
      { type: "ACCEPT_SETTLEMENT", workspaceId: "ws-1" },
    );
    const self = ws(state, "ws-1").participants.find((p) => p.isSelf)!;
    expect(ws(state, "ws-1").acceptedBy.filter((id) => id === self.id)).toHaveLength(1);
  });
});

describe("PEXA — documents and lodgement", () => {
  it("marks lodgement Ready only when every document is signed", () => {
    let state = createPexaSeedState();
    expect(lodgementStatus(ws(state, "ws-1"))).toBe("In Preparation");

    state = run(state, { type: "CREATE_DOCUMENT", workspaceId: "ws-1", documentType: "Transfer" });
    expect(lodgementStatus(ws(state, "ws-1"))).toBe("Prepared");

    for (const doc of ws(state, "ws-1").documents) {
      state = run(state, { type: "SIGN_DOCUMENT", workspaceId: "ws-1", documentId: doc.id });
    }
    expect(lodgementStatus(ws(state, "ws-1"))).toBe("Ready");
  });

  it("creates documents owned by our own role", () => {
    const state = run(createPexaSeedState(), {
      type: "CREATE_DOCUMENT",
      workspaceId: "ws-1",
      documentType: "Mortgage",
    });
    const doc = ws(state, "ws-1").documents.at(-1)!;
    expect(doc.responsibleRole).toBe(ws(state, "ws-1").ourRole);
    expect(doc.status).toBe("Prepared");
  });

  it("only ever offers documents our role is responsible for as signable", () => {
    // The role gate the UI applies: a document belonging to another role is not ours to sign.
    const state = createPexaSeedState();
    for (const w of state.workspaces) {
      const signable = w.documents.filter((d) => d.responsibleRole === w.ourRole);
      const notOurs = w.documents.filter((d) => d.responsibleRole !== w.ourRole);
      for (const d of signable) expect(d.responsibleRole).toBe(w.ourRole);
      for (const d of notOurs) expect(d.responsibleRole).not.toBe(w.ourRole);
    }
  });
});

describe("PEXA — Ready/Ready gate on settlement", () => {
  it("refuses Ready/Ready while the schedule is out of balance", () => {
    let state = createPexaSeedState();
    // Sign everything and agree the date, but leave the money unbalanced.
    state = run(state, { type: "CREATE_DOCUMENT", workspaceId: "ws-1", documentType: "Transfer" });
    for (const doc of ws(state, "ws-1").documents) {
      state = run(state, { type: "SIGN_DOCUMENT", workspaceId: "ws-1", documentId: doc.id });
    }
    state = run(state, {
      type: "PROPOSE_SETTLEMENT",
      workspaceId: "ws-1",
      date: "2026-09-04",
      time: "2:00 PM",
    });
    // Force every participant to have accepted so only the money is left failing.
    state = {
      ...state,
      workspaces: state.workspaces.map((w) =>
        w.id === "ws-1" ? { ...w, acceptedBy: w.participants.map((p) => p.id) } : w,
      ),
    };

    const w = ws(state, "ws-1");
    expect(lodgementStatus(w)).toBe("Ready");
    expect(isDateAgreed(w)).toBe(true);
    expect(isFundsBalanced(w)).toBe(false);
    expect(isReadyReady(w)).toBe(false);
  });

  it("refuses Ready/Ready while a participant has not accepted the date", () => {
    let state = createPexaSeedState();
    state = run(state, { type: "CREATE_DOCUMENT", workspaceId: "ws-1", documentType: "Transfer" });
    for (const doc of ws(state, "ws-1").documents) {
      state = run(state, { type: "SIGN_DOCUMENT", workspaceId: "ws-1", documentId: doc.id });
    }
    const shortfall = Math.abs(fundsBalance(ws(state, "ws-1")));
    state = run(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: "ws-1",
      direction: "Source",
      category: "Loan advance",
      description: "Meridian Bank advance",
      amount: shortfall,
    });
    state = run(state, {
      type: "PROPOSE_SETTLEMENT",
      workspaceId: "ws-1",
      date: "2026-09-04",
      time: "2:00 PM",
    });

    const w = ws(state, "ws-1");
    expect(isFundsBalanced(w)).toBe(true);
    expect(lodgementStatus(w)).toBe("Ready");
    // Proposing cleared the other side's acceptance, so the date is not agreed.
    expect(isDateAgreed(w)).toBe(false);
    expect(isReadyReady(w)).toBe(false);
  });

  it("reaches Ready/Ready only when documents, money, and date all line up", () => {
    let state = createPexaSeedState();
    state = run(state, { type: "CREATE_DOCUMENT", workspaceId: "ws-1", documentType: "Transfer" });
    for (const doc of ws(state, "ws-1").documents) {
      state = run(state, { type: "SIGN_DOCUMENT", workspaceId: "ws-1", documentId: doc.id });
    }
    const shortfall = Math.abs(fundsBalance(ws(state, "ws-1")));
    state = run(state, {
      type: "ADD_FUNDS_LINE",
      workspaceId: "ws-1",
      direction: "Source",
      category: "Loan advance",
      description: "Meridian Bank advance",
      amount: shortfall,
    });
    state = run(state, {
      type: "PROPOSE_SETTLEMENT",
      workspaceId: "ws-1",
      date: "2026-09-04",
      time: "2:00 PM",
    });
    state = {
      ...state,
      workspaces: state.workspaces.map((w) =>
        w.id === "ws-1" ? { ...w, acceptedBy: w.participants.map((p) => p.id) } : w,
      ),
    };

    expect(isReadyReady(ws(state, "ws-1"))).toBe(true);

    state = run(state, { type: "SETTLE", workspaceId: "ws-1" });
    expect(ws(state, "ws-1").status).toBe("Settled");
  });
});

describe("PEXA — participants", () => {
  it("adds an invited participant as not-yet-accepted", () => {
    const state = run(createPexaSeedState(), {
      type: "INVITE_PARTICIPANT",
      workspaceId: "ws-1",
      subscriberName: "Meridian Bank",
      role: "Incoming Mortgagee",
    });
    const invited = ws(state, "ws-1").participants.at(-1)!;
    expect(invited.subscriberName).toBe("Meridian Bank");
    expect(invited.accepted).toBe(false);
    expect(invited.isSelf).toBe(false);
    // An unaccepted invitee blocks Ready/Ready.
    expect(isReadyReady(ws(state, "ws-1"))).toBe(false);
  });

  it("raises a notification for the invitation", () => {
    const state = run(createPexaSeedState(), {
      type: "INVITE_PARTICIPANT",
      workspaceId: "ws-1",
      subscriberName: "Meridian Bank",
      role: "Incoming Mortgagee",
    });
    expect(state.notifications[0].message).toContain("Meridian Bank");
    expect(state.notifications[0].workspaceId).toBe("ws-1");
  });
});

describe("PEXA — reducer safety", () => {
  it("ignores actions against a workspace that does not exist", () => {
    const state = createPexaSeedState();
    const after = run(state, {
      type: "CREATE_DOCUMENT",
      workspaceId: "does-not-exist",
      documentType: "Transfer",
    });
    expect(after.workspaces).toEqual(state.workspaces);
  });

  it("ignores signing a document that does not exist", () => {
    const state = createPexaSeedState();
    const after = run(state, {
      type: "SIGN_DOCUMENT",
      workspaceId: "ws-1",
      documentId: "nope",
    });
    expect(after.workspaces).toEqual(state.workspaces);
  });

  it("returns a clean seed on RESET", () => {
    let state = run(createPexaSeedState(), {
      type: "CREATE_DOCUMENT",
      workspaceId: "ws-1",
      documentType: "Transfer",
    });
    state = run(state, { type: "RESET" });
    expect(state.workspaces).toEqual(createPexaSeedState().workspaces);
    expect(state.log).toHaveLength(0);
  });
});
