type LogLevel = "info" | "warn" | "error";

type LogContext = {
  route: string;
  requestId: string;
  startedAtMs: number;
};

type LogFields = Record<string, unknown>;

function emitLog(level: LogLevel, message: string, fields: LogFields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function createRouteLogContext(route: string): LogContext {
  return {
    route,
    requestId: crypto.randomUUID(),
    startedAtMs: Date.now(),
  };
}

export function maskAddress(address?: string | null) {
  if (!address) {
    return null;
  }

  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function summarizeText(text?: string | null, maxLength = 120) {
  if (!text) {
    return null;
  }

  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

export function logRouteStart(context: LogContext, fields: LogFields = {}) {
  emitLog("info", "route.start", {
    route: context.route,
    requestId: context.requestId,
    ...fields,
  });
}

export function logRouteSuccess(context: LogContext, fields: LogFields = {}) {
  emitLog("info", "route.success", {
    route: context.route,
    requestId: context.requestId,
    durationMs: Date.now() - context.startedAtMs,
    ...fields,
  });
}

export function logRouteWarn(context: LogContext, message: string, fields: LogFields = {}) {
  emitLog("warn", message, {
    route: context.route,
    requestId: context.requestId,
    durationMs: Date.now() - context.startedAtMs,
    ...fields,
  });
}

export function logRouteError(
  context: LogContext,
  error: unknown,
  fields: LogFields = {},
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "UnknownError";

  emitLog("error", "route.error", {
    route: context.route,
    requestId: context.requestId,
    durationMs: Date.now() - context.startedAtMs,
    errorName,
    errorMessage,
    ...fields,
  });
}

export function attachRequestIdHeader(response: Response, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}
