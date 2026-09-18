import { describe, expect, it } from "vitest";
import { classifySlideFlavor } from "@/lib/lesson-slide-flavor";

describe("Classifying a lesson section's slide flavor", () => {
  it("recognises objectives sections", () => {
    expect(classifySlideFlavor("Learning Objectives")).toBe("objectives");
    expect(classifySlideFlavor("What You'll Learn")).toBe("objectives");
  });

  it("recognises warnings before tips, since 'important' can appear in either", () => {
    expect(classifySlideFlavor("Important Warning")).toBe("warning");
    expect(classifySlideFlavor("Caution: Deposit Timing")).toBe("warning");
  });

  it("recognises tips", () => {
    expect(classifySlideFlavor("VA Tip")).toBe("tip");
  });

  it("recognises checklists, examples, and summaries", () => {
    expect(classifySlideFlavor("Pre-Settlement Checklist")).toBe("checklist");
    expect(classifySlideFlavor("Example: A Late Deposit")).toBe("example");
    expect(classifySlideFlavor("Practical Scenario")).toBe("example");
    expect(classifySlideFlavor("Key Takeaways")).toBe("summary");
  });

  it("falls back to a plain content slide for anything else", () => {
    expect(classifySlideFlavor("Introduction")).toBe("content");
    expect(classifySlideFlavor("Reviewing the Contract")).toBe("content");
    expect(classifySlideFlavor("")).toBe("content");
  });
});
