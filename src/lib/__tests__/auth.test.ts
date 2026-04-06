import {
  buildWalletAuthMessage,
  getCookieValue,
  normalizeWalletAddress,
} from "@/lib/auth";

describe("auth helpers", () => {
  it("builds a stable wallet auth message", () => {
    const message = buildWalletAuthMessage("0xAbC123", "nonce-123");

    expect(message).toContain("Agent Bazaar authentication");
    expect(message).toContain("Wallet: 0xAbC123");
    expect(message).toContain("Nonce: nonce-123");
  });

  it("normalizes wallet addresses and reads cookies", () => {
    expect(normalizeWalletAddress(" 0xAbCd ")).toBe("0xabcd");
    expect(getCookieValue("foo=bar; agent_bazaar_session=token123", "agent_bazaar_session")).toBe("token123");
  });
});
