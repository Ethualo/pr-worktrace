import { describe, it, expect } from "vitest";
import { classifyDecision } from "./classifyDecision.js";

describe("classifyDecision", () => {
  it("returns 'accepted' when thumbsUp outnumbers thumbsDown", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 2, thumbsDown: 0 })).toBe("accepted");
  });

  it("returns 'rejected' when thumbsDown outnumbers thumbsUp", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 0, thumbsDown: 1 })).toBe("rejected");
  });

  it("returns 'unclear' when there are no reactions", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 0, thumbsDown: 0 })).toBe("unclear");
  });

  it("returns 'unclear' on a tie", () => {
    expect(classifyDecision({ commentId: 1, thumbsUp: 1, thumbsDown: 1 })).toBe("unclear");
  });
});
