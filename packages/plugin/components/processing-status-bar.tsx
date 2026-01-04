import * as React from 'react';
import { Inbox } from '../inbox';
import { FileRecord, Action, RecordManager } from '../inbox/services/record-manager';
import { FileOrganizer } from '../index';
import { getActionDisplayName } from '../inbox/index';

function calculateProgress(record: FileRecord): number {
  // Define total pipeline steps (excluding optional ones)
  const totalSteps = [
    Action.CLEANUP,
    Action.VALIDATE,
    Action.CONTAINER,
    Action.MOVING_ATTACHMENT,
    Action.EXTRACT,
    Action.CLASSIFY,
    Action.MOVING,
    Action.RENAME,
    Action.FORMATTING,
    Action.APPEND,
    Action.TAGGING,
    Action.COMPLETED,
  ].length;

  // Count completed steps (excluding skipped)
  const completedSteps = Object.values(record.logs).filter(
    (log) => log.completed && !log.skipped
  ).length;

  return Math.round((completedSteps / totalSteps) * 100);
}

function getCurrentAction(record: FileRecord, app: any): string {
  try {
    const recordManager = RecordManager.getInstance(app);
    const lastStep = recordManager.getLastStep(record.id);
    if (!lastStep) return '';

    return getActionDisplayName(lastStep);
  } catch (error) {
    return '';
  }
}

export function ProcessingStatusBar({ plugin }: { plugin: FileOrganizer }) {
  const [status, setStatus] = React.useState<{
    currentFile?: string;
    currentAction?: string;
    queuePosition?: number;
    totalInQueue?: number;
    progress?: number;
  } | null>(null);

  // Poll inbox status every 500ms
  React.useEffect(() => {
    const interval = setInterval(() => {
      try {
        const inbox = Inbox.getInstance();
        const analytics = inbox.getAnalytics();
        const queueStats = inbox.getQueueStats();

        // Find currently processing file
        const allRecords = inbox.getAllFiles();
        const processing = allRecords.find((r) => r.status === 'processing');
        const queued = allRecords.filter((r) => r.status === 'queued');
        const processingList = allRecords.filter(
          (r) => r.status === 'processing'
        );

        if (processing || queueStats.queued > 0) {
          const totalInQueue = queueStats.queued + queueStats.processing;
          let queuePosition: number | undefined;

          if (processing) {
            // Calculate position: queued files + position in processing list
            const processingIndex = processingList.findIndex(
              (r) => r.id === processing.id
            );
            queuePosition = queued.length + processingIndex + 1;
          } else if (queued.length > 0) {
            // If no processing but queued, show first in queue
            queuePosition = 1;
          }

          // Calculate progress based on completed steps
          let progress = 0;
          let currentAction: string | undefined;
          if (processing) {
            progress = calculateProgress(processing);
            currentAction = getCurrentAction(
              processing,
              plugin.app
            );
          }

          setStatus({
            currentFile: processing?.originalName,
            currentAction,
            queuePosition,
            totalInQueue,
            progress,
          });
        } else {
          setStatus(null);
        }
      } catch (error) {
        // Silently handle errors (Inbox might not be initialized)
        setStatus(null);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [plugin]);

  if (!status) return null;

  return (
    <div
      className="processing-status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: 'var(--font-ui-smaller)',
        color: 'var(--text-muted)',
      }}
    >
      {status.currentFile && (
        <span>
          Processing: {status.currentFile}
          {status.currentAction && ` (${status.currentAction})`}
          {status.progress !== undefined && status.progress > 0 && (
            <span> {status.progress}%</span>
          )}
        </span>
      )}
      {status.queuePosition &&
        status.totalInQueue !== undefined &&
        status.totalInQueue > 1 && (
          <span>Queue: {status.queuePosition}/{status.totalInQueue}</span>
        )}
    </div>
  );
}

