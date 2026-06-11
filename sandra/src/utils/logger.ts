type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, component: string, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    timestamp: formatTimestamp(),
    level,
    component,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(entry);

  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (component: string, message: string, meta?: Record<string, unknown>) =>
    log("INFO", component, message, meta),
  warn: (component: string, message: string, meta?: Record<string, unknown>) =>
    log("WARN", component, message, meta),
  error: (component: string, message: string, meta?: Record<string, unknown>) =>
    log("ERROR", component, message, meta),
  debug: (component: string, message: string, meta?: Record<string, unknown>) =>
    log("DEBUG", component, message, meta),
};
