import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/** Log levels */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Logger configuration */
interface LoggerConfig {
  level: LogLevel;
  file?: string;
}

class Logger {
  private config: LoggerConfig = {
    level: "info",
  };
  private fileStream?: fs.WriteStream;

  /**
   * Initialize logger with configuration.
   */
  init(config: LoggerConfig): void {
    // Close existing file stream if any
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }

    this.config = config;

    // Determine log file path: use config file or default to temp folder
    const logFilePath = config.file || path.join(os.tmpdir(), "ingest-music.log");

    try {
      // Ensure directory exists
      const dir = path.dirname(logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Open append stream
      this.fileStream = fs.createWriteStream(logFilePath, { flags: "a" });
      this.fileStream.write(`\n[${new Date().toISOString()}] New session started\n`);
    } catch (error) {
      console.error(`Failed to open log file ${logFilePath}:`, error);
    }
  }

  /**
   * Check if a given level should be logged based on configured level.
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Format a log message with timestamp and level.
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Write a log message to the file only (never to console).
   */
  private write(level: LogLevel, message: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message);

    // Write to file only
    if (this.fileStream) {
      this.fileStream.write(formatted + "\n");
    }
  }

  /** Enable or disable debug logging (legacy API) */
  setDebug(enabled: boolean): void {
    this.config.level = enabled ? "debug" : "info";
  }

  /** Check if debug is enabled */
  isDebugEnabled(): boolean {
    return this.config.level === "debug";
  }

  /** Log debug message (only if debug enabled) */
  debug(message: string, data?: unknown): void {
    let fullMessage = message;
    if (data !== undefined) {
      fullMessage += `\n${JSON.stringify(data, null, 2)}`;
    }
    this.write("debug", fullMessage);
  }

  /** Log info message */
  info(message: string): void {
    this.write("info", message);
  }

  /** Log warning message */
  warn(message: string): void {
    this.write("warn", message);
  }

  /** Log error message */
  error(message: string, error?: unknown): void {
    let fullMessage = message;
    if (error !== undefined) {
      if (error instanceof Error) {
        fullMessage += `\n${error.message}\n${error.stack || ""}`;
      } else {
        fullMessage += `\n${JSON.stringify(error, null, 2)}`;
      }
    }
    this.write("error", fullMessage);
  }

  /**
   * Log a curl command for an API request (debug only)
   * @param method HTTP method
   * @param url Request URL
   * @param headers Optional headers object
   * @param body Optional request body
   */
  logCurl(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: unknown
  ): void {
    if (!this.shouldLog("debug")) return;

    let curl = `curl -X ${method} '${url}'`;

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        curl += ` \\\n  -H '${key}: ${value}'`;
      }
    }

    if (body) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      curl += ` \\\n  -d '${bodyStr}'`;
    }

    this.debug(`API Call:\n${curl}`);
  }

  /**
   * Log raw API response (debug only).
   */
  logApiResponse(apiName: string, response: unknown): void {
    if (!this.shouldLog("debug")) return;
    this.debug(`${apiName} Response:\n${JSON.stringify(response, null, 2)}`);
  }

  /**
   * Close the file stream if open (cleanup on exit).
   */
  close(): void {
    if (this.fileStream) {
      this.fileStream.write(`[${new Date().toISOString()}] Session ended\n`);
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }
}

/** Global logger instance */
export const logger = new Logger();
