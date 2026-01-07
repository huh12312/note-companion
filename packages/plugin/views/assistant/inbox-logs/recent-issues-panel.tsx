import * as React from "react";
import { FileRecord, FileStatus, RecordManager, Action } from "../../../inbox/services/record-manager";
import { usePlugin } from "../provider";
import { TFile, Notice } from "obsidian";
import { Inbox } from "../../../inbox";
import { tw } from "../../../lib/utils";
import { RotateCcw, AlertCircle, Ban } from "lucide-react";
import { Button } from "../../../components/ui/button";

// Status badge component (reused from inbox-logs.tsx pattern)
const StatusBadge: React.FC<{ status: FileStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case "error":
        return "bg-[--text-error]";
      case "bypassed":
        return "bg-[--text-muted]";
      default:
        return "bg-[--text-muted]";
    }
  };

  return (
    <span className="inline-flex items-center">
      <span className="sr-only">{status}</span>
      <span
        className={`w-2 h-2 rounded-full ${getStatusColor()}`}
        aria-hidden="true"
      />
    </span>
  );
};

// Issue card component
const IssueCard: React.FC<{
  record: FileRecord;
  plugin: any;
  onRetry: (record: FileRecord) => Promise<void>;
}> = ({ record, plugin, onRetry }) => {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const recordManager = RecordManager.getInstance(plugin.app);
  const lastError = recordManager.getLastError(record.id);

  // Get error message or bypass reason
  const getErrorMessage = (): string => {
    if (record.status === "error" && lastError?.error?.message) {
      return lastError.error.message;
    }
    if (record.status === "bypassed") {
      // Try to extract bypass reason from error messages
      // Bypassed files throw errors with "Bypassed due to " + reason
      const allErrors = Object.values(record.logs)
        .filter(log => log.error)
        .map(log => log.error!.message);

      // Look for bypass reason in error messages
      for (const errorMsg of allErrors) {
        if (errorMsg.includes("Bypassed due to")) {
          const reason = errorMsg.replace("Bypassed due to ", "").trim();
          return reason || "File bypassed";
        }
      }

      // Fallback: check last error
      if (lastError?.error?.message) {
        const msg = lastError.error.message;
        if (msg.includes("Bypassed due to")) {
          return msg.replace("Bypassed due to ", "").trim();
        }
        return msg;
      }

      return "File bypassed";
    }
    return "Unknown issue";
  };

  const errorMessage = getErrorMessage();

  // Get most recent timestamp
  const getMostRecentTimestamp = (): string => {
    const timestamps = Object.values(record.logs).map(log => log.timestamp);
    if (timestamps.length === 0) return "";
    return timestamps.sort().reverse()[0];
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry(record);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="border-b border-[--background-modifier-border] p-2 hover:bg-[--background-modifier-hover]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={record.status} />
            <div className="text-sm text-[--text-normal] truncate">
              {record.originalName}
            </div>
          </div>
          <div className="text-xs text-[--text-muted] truncate">
            {errorMessage}
          </div>
          {getMostRecentTimestamp() && (
            <div className="text-xs text-[--text-faint] mt-0.5">
              {new Date(getMostRecentTimestamp()).toLocaleString()}
            </div>
          )}
        </div>
        <Button
          onClick={handleRetry}
          disabled={isRetrying}
          size="sm"
          variant="outline"
          className={tw("flex items-center gap-1 text-xs")}
          title="Retry processing this file"
        >
          <RotateCcw className={tw(`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`)} />
          {isRetrying ? "Retrying..." : "Retry"}
        </Button>
      </div>
    </div>
  );
};

// Main Recent Issues Panel component
export const RecentIssuesPanel: React.FC<{ plugin: any }> = ({ plugin }) => {
  const [issues, setIssues] = React.useState<FileRecord[]>([]);

  // Fetch and filter issues
  React.useEffect(() => {
    const fetchIssues = () => {
      try {
        const recordManager = RecordManager.getInstance(plugin.app);
        const allRecords = recordManager.getAllRecords();

        // Filter for error and bypassed files
        const errorAndBypassed = allRecords.filter(
          (r) => r.status === "error" || r.status === "bypassed"
        );

        // Sort by most recent timestamp
        const sorted = errorAndBypassed.sort((a, b) => {
          const getLatestTimestamp = (record: FileRecord): number => {
            const timestamps = Object.values(record.logs).map((log) =>
              new Date(log.timestamp).getTime()
            );
            return timestamps.length > 0 ? Math.max(...timestamps) : 0;
          };

          return getLatestTimestamp(b) - getLatestTimestamp(a);
        });

        // Limit to last 10
        setIssues(sorted.slice(0, 10));
      } catch (error) {
        console.error("Error fetching issues:", error);
        setIssues([]);
      }
    };

    fetchIssues();
    // Poll every 2 seconds (less frequent than main InboxLogs since this is a summary)
    const interval = setInterval(fetchIssues, 2000);
    return () => clearInterval(interval);
  }, [plugin.app]);

  // Retry handler
  const handleRetry = React.useCallback(
    async (record: FileRecord) => {
      try {
        const inbox = Inbox.getInstance();
        let fileToRetry: TFile | null = null;

        // Try to find the file
        if (record.file) {
          fileToRetry = record.file;
        } else {
          // File might have been moved to error/bypass folder
          // Try to find it by searching common error/bypass paths
          const errorPath = plugin.settings.errorFilePath;
          const bypassPath = plugin.settings.bypassedFilePath;
          const inboxPath = plugin.settings.pathToWatch;

          // Try error folder first (check both originalName and newName)
          if (errorPath) {
            const searchNames = [record.originalName];
            if (record.newName) searchNames.push(record.newName);

            for (const name of searchNames) {
              const errorFile = plugin.app.vault.getAbstractFileByPath(
                `${errorPath}/${name}`
              );
              if (errorFile instanceof TFile) {
                fileToRetry = errorFile;
                break;
              }
            }
          }

          // Try bypass folder
          if (!fileToRetry && bypassPath) {
            const searchNames = [record.originalName];
            if (record.newName) searchNames.push(record.newName);

            for (const name of searchNames) {
              const bypassFile = plugin.app.vault.getAbstractFileByPath(
                `${bypassPath}/${name}`
              );
              if (bypassFile instanceof TFile) {
                fileToRetry = bypassFile;
                break;
              }
            }
          }

          // Try inbox folder
          if (!fileToRetry && inboxPath) {
            const searchNames = [record.originalName];
            if (record.newName) searchNames.push(record.newName);

            for (const name of searchNames) {
              const inboxFile = plugin.app.vault.getAbstractFileByPath(
                `${inboxPath}/${name}`
              );
              if (inboxFile instanceof TFile) {
                fileToRetry = inboxFile;
                break;
              }
            }
          }

          // Try searching by original name across all files
          if (!fileToRetry) {
            const allLoadedFiles = plugin.app.vault.getAllLoadedFiles();
            const allFiles = allLoadedFiles.filter((f) => f instanceof TFile) as TFile[];
            fileToRetry =
              allFiles.find((f) => f.basename === record.originalName || f.name === record.originalName) || null;
          }
        }

        if (!fileToRetry) {
          new Notice(
            `Cannot retry: File "${record.originalName}" not found in vault`
          );
          return;
        }

        // If file is in error/bypass folder, move it back to inbox first
        const currentPath = fileToRetry.path;
        const inboxPath = plugin.settings.pathToWatch;
        const errorPath = plugin.settings.errorFilePath;
        const bypassPath = plugin.settings.bypassedFilePath;

        if (
          (errorPath && currentPath.startsWith(errorPath)) ||
          (bypassPath && currentPath.startsWith(bypassPath))
        ) {
          // Move back to inbox
          const targetPath = `${inboxPath}/${fileToRetry.name}`;
          await plugin.app.fileManager.renameFile(fileToRetry, targetPath);
          // Get the file again after move
          fileToRetry =
            plugin.app.vault.getAbstractFileByPath(targetPath) || null;
          if (!fileToRetry) {
            new Notice("Failed to move file back to inbox");
            return;
          }
        }

        // Re-enqueue the file
        inbox.enqueueFile(fileToRetry);
        new Notice(`Retrying processing for ${record.originalName}`);
      } catch (error: any) {
        console.error("Error retrying file:", error);
        new Notice(`Failed to retry: ${error.message || "Unknown error"}`);
      }
    },
    [plugin]
  );

  // Don't render if no issues
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[--background-modifier-border]">
      <div className="px-3 py-2 bg-[--background-secondary]">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-[--text-error]" />
          <h3 className="text-sm font-semibold text-[--text-normal]">
            Recent Issues ({issues.length})
          </h3>
        </div>
        <div className="text-xs text-[--text-muted] mb-2">
          Files that failed processing or were bypassed
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {issues.map((record) => (
          <IssueCard
            key={record.id}
            record={record}
            plugin={plugin}
            onRetry={handleRetry}
          />
        ))}
      </div>
    </div>
  );
};

