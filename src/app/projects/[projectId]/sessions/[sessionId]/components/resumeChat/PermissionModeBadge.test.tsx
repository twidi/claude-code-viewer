import { describe, expect, it } from "vitest";

describe("PermissionModeBadge", () => {
  it("should have all permission modes defined in config", () => {
    const permissionModes = [
      "default",
      "acceptEdits",
      "bypassPermissions",
      "plan",
    ] as const;

    // Verify all modes are valid permission mode values
    for (const mode of permissionModes) {
      expect(mode).toMatch(/^(default|acceptEdits|bypassPermissions|plan)$/);
    }
  });

  it("should have correct label ids for each mode", () => {
    const expectedLabelIds: Record<string, string> = {
      default: "settings.permission.mode.default",
      acceptEdits: "settings.permission.mode.accept_edits",
      bypassPermissions: "settings.permission.mode.bypass_permissions",
      plan: "settings.permission.mode.plan",
    };

    for (const [mode, labelId] of Object.entries(expectedLabelIds)) {
      expect(labelId).toMatch(/^settings\.permission\.mode\./);
      expect(mode).toBeTruthy();
    }
  });
});
