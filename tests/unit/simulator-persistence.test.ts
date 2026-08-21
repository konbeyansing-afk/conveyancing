/**
 * The simulators persist their whole state to sessionStorage as JSON so a
 * refresh does not throw away a trainee's work mid-scenario.
 *
 * JSON is lossy for anything that is not a plain value — a Date becomes a
 * string, a Map or Set becomes {}, undefined disappears. These tests fail if
 * someone puts such a value into simulator state, which would otherwise show
 * up as a simulator that quietly corrupts itself on refresh.
 */

import { describe, expect, it } from "vitest";
import { simReducer, STORAGE_KEY as SIM_KEY, type SimAction } from "@/lib/simulator/store";
import { createSeedState } from "@/lib/simulator/seed";
import { pexaReducer, STORAGE_KEY as PEXA_KEY, type PexaAction } from "@/lib/pexa/store";
import { createPexaSeedState } from "@/lib/pexa/seed";
import { asReducer, STORAGE_KEY as AS_KEY, type AsAction } from "@/lib/actionstep/store";
import { createAsSeedState } from "@/lib/actionstep/seed";

const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("Simulator state survives a JSON round trip", () => {
  it("practice-system seed state", () => {
    const seed = createSeedState();
    expect(roundTrip(seed)).toEqual(seed);
  });

  it("PEXA seed state", () => {
    const seed = createPexaSeedState();
    expect(roundTrip(seed)).toEqual(seed);
  });

  it("Actionstep seed state", () => {
    const seed = createAsSeedState();
    expect(roundTrip(seed)).toEqual(seed);
  });

  it("practice-system state after a trainee has done work", () => {
    const actions: SimAction[] = [
      { type: "OPEN_MATTER", matterId: "m-4182" },
      { type: "MATTER_TAB", tab: "memos" },
      { type: "ADD_MEMO", matterId: "m-4182", title: "Note", body: "Key left with agent." },
    ];
    const state = actions.reduce(simReducer, createSeedState());
    expect(roundTrip(state)).toEqual(state);
  });

  it("PEXA state after a trainee has done work", () => {
    const actions: PexaAction[] = [
      { type: "OPEN_WORKSPACE", workspaceId: "ws-2" },
      { type: "SET_TAB", tab: "financial" },
      {
        type: "ADD_FUNDS_LINE",
        workspaceId: "ws-2",
        direction: "Destination",
        category: "Council rates adjustment",
        description: "Rates to vendor",
        amount: 669.65,
      },
    ];
    const state = actions.reduce(pexaReducer, createPexaSeedState());
    const restored = roundTrip(state);
    expect(restored).toEqual(state);
    // The money must come back as a number, not a string.
    const line = restored.workspaces
      .find((w) => w.id === "ws-2")!
      .funds.find((f) => f.description === "Rates to vendor")!;
    expect(typeof line.amount).toBe("number");
    expect(line.amount).toBe(669.65);
  });

  it("Actionstep state after a trainee has done work", () => {
    const actions: AsAction[] = [
      { type: "OPEN_MATTER", matterId: "am-1" },
      { type: "SET_TAB", tab: "steps" },
      {
        type: "ADD_PARTICIPANT",
        matterId: "am-1",
        name: "Meridian Bank",
        participantType: "Incoming Lender",
        email: "settlements@meridianbank.example",
        phone: "13 20 40",
      },
    ];
    const state = actions.reduce(asReducer, createAsSeedState());
    expect(roundTrip(state)).toEqual(state);
  });
});

describe("Storage keys", () => {
  it("gives each simulator its own key so they cannot overwrite each other", () => {
    const keys = [SIM_KEY, PEXA_KEY, AS_KEY];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^conveyancing-academy:sim:/);
  });
});
