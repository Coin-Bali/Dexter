import {
  getNetworkConfig,
  getNetworkFromPreference,
  getPreferenceFromNetwork,
  getSupportedToken,
} from "@/lib/networks";

describe("network registry", () => {
  it("maps preference values to route/network configs", () => {
    expect(getNetworkFromPreference("base")).toBe("base");
    expect(getNetworkFromPreference("base_sepolia")).toBe("base-sepolia");
    expect(getPreferenceFromNetwork("base")).toBe("base");
    expect(getPreferenceFromNetwork("base-sepolia")).toBe("base_sepolia");
  });

  it("returns expected base token metadata", () => {
    const baseConfig = getNetworkConfig("base");
    const usdc = getSupportedToken("base", "USDC");

    expect(baseConfig.chainId).toBe(8453);
    expect(baseConfig.x402Network).toBe("eip155:8453");
    expect(usdc?.address).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
});
