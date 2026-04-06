import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import RegistrationFlow from "@/components/RegistrationFlow";

describe("RegistrationFlow", () => {
  it("keeps the submit button disabled until a display name is entered", () => {
    render(
      <RegistrationFlow
        user={{
          id: "user_1",
          walletAddress: "0x80a4C80C1284a2586DD13f705476aBA58C1ee10a",
          displayName: null,
          roleDescription: null,
          preferredNetwork: "base_sepolia",
          themeMode: "system",
          registrationCompleted: false,
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        }}
        onCompleted={vi.fn(async () => {})}
      />,
    );

    const button = screen.getByRole("button", { name: /continue to the app/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/how should we refer to you/i), {
      target: { value: "Alice" },
    });

    expect(button).not.toBeDisabled();
  });
});
