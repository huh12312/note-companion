import { useState } from "react";
import { Button } from "../assistant/ai-chat/button";
import FileOrganizer from "../..";
import { Notice } from "obsidian";
import { validateApiKey } from "../../apiUtils";

export function TopUpCredits({
  plugin,
  onLicenseKeyChange,
}: {
  plugin: FileOrganizer;
  onLicenseKeyChange: (licenseKey: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    // Validate API key before making request
    const validation = validateApiKey(plugin.settings.API_KEY);
    if (!validation.isValid) {
      new Notice(validation.error || "Invalid API key", 5000);
      return;
    }

    // Warn if key seems too short but still allow attempt
    if (validation.error) {
      console.warn("API key validation warning:", validation.error);
    }

    try {
      setLoading(true);
      const response = await fetch(`${plugin.getServerUrl()}/api/top-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${plugin.settings.API_KEY}`,
        },
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
      onLicenseKeyChange(data.licenseKey);
    } catch (error) {
      console.error("Top-up error:", error);
      new Notice("Failed to process top-up request", 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleTopUp} disabled={loading} className="w-full">
      {loading
        ? "Processing..."
        : "Top Up $15 worth of credits"}
    </Button>
  );
}
