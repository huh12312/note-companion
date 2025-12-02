interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  timestamp: number;
  details?: string;
}

class LoggerService {
  private isEnabled = false;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs

  configure(enabled: boolean) {
    this.isEnabled = enabled;
  }

  private addLog(level: LogEntry['level'], message: string, details?: string) {
    if (!this.isEnabled) return;

    this.logs.push({
      level,
      message,
      timestamp: Date.now(),
      details,
    });

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  info(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    this.addLog('info', message);
    console.info(...messages);
  }

  error(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    this.addLog('error', message);
    console.error(...messages);
  }

  warn(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    this.addLog('warn', message);
    console.warn(...messages);
  }

  debug(...messages: any[]) {
    const message = messages.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ');
    this.addLog('debug', message);
    console.debug(...messages);
  }

  getLogs(): LogEntry[] {
    return [...this.logs]; // Return a copy to prevent mutation
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = new LoggerService();