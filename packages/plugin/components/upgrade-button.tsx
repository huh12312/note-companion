import React from "react";
import FileOrganizer from "../index";
import { tw } from "../lib/utils";
import { ArrowUpCircle } from "lucide-react";
import { UsageData } from "../index";

interface UpgradeButtonProps {
  plugin: FileOrganizer;
  variant?: "default" | "compact";
  showMessage?: boolean;
  className?: string;
  usageData?: UsageData | null;
  isForced?: boolean;
}

export function UpgradeButton({
  plugin,
  variant = "default",
  showMessage = false,
  className,
  usageData,
  isForced = false,
}: UpgradeButtonProps) {
  const handleClick = () => {
    plugin.openUpgradePlanModal();
  };

  // Generate tooltip message based on usage
  const getTooltip = (): string => {
    if (isForced) {
      return "Token limit exceeded. Upgrade your plan to continue using Note Companion.";
    }

    if (!usageData) {
      return "Upgrade your plan for more tokens and features.";
    }

    const usagePercent = (usageData.tokenUsage / usageData.maxTokenUsage) * 100;
    const remaining = usageData.maxTokenUsage - usageData.tokenUsage;
    const formattedRemaining = remaining.toLocaleString();
    const formattedUsed = usageData.tokenUsage.toLocaleString();
    const formattedMax = usageData.maxTokenUsage.toLocaleString();

    if (usagePercent >= 100) {
      return `Token limit reached (${formattedUsed}/${formattedMax}). Upgrade to continue using Note Companion.`;
    } else if (usagePercent >= 90) {
      return `Almost out of tokens (${formattedUsed}/${formattedMax} used, ${formattedRemaining} remaining). Upgrade now to avoid interruption.`;
    } else {
      return `Running low on tokens (${formattedUsed}/${formattedMax} used, ${formattedRemaining} remaining). Upgrade for more capacity.`;
    }
  };

  // Determine color based on usage
  const getColorClasses = (): string => {
    if (isForced || !usageData) {
      // Error state - use error color
      return "bg-[--text-error] text-[--text-on-accent] hover:opacity-90";
    }

    const usagePercent = (usageData.tokenUsage / usageData.maxTokenUsage) * 100;

    if (usagePercent >= 100) {
      // Critical - use error color
      return "bg-[--text-error] text-[--text-on-accent] hover:opacity-90";
    } else if (usagePercent >= 90) {
      // Warning - use warning color
      return "bg-[--text-warning] text-[--text-on-accent] hover:opacity-90";
    } else {
      // Normal - use accent color
      return "bg-[--interactive-accent] text-[--text-on-accent] hover:bg-[--interactive-accent-hover]";
    }
  };

  const tooltip = getTooltip();
  const colorClasses = getColorClasses();

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        className={tw(
          "px-2 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5",
          colorClasses,
          className
        )}
        title={tooltip}
      >
        <ArrowUpCircle className={tw("w-3.5 h-3.5")} />
        {showMessage && <span>Upgrade</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={tw(
        "px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-2",
        colorClasses,
        className
      )}
      title={tooltip}
    >
      <ArrowUpCircle className={tw("w-4 h-4")} />
      <span>Upgrade Plan</span>
    </button>
  );
}

