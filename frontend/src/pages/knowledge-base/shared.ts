export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

export function statusTone(status: string): "slate" | "green" | "amber" | "rose" | "cyan" {
  if (status === "COMPLETED" || status === "READY" || status === "SUCCEEDED" || status === "INDEXED") {
    return "green";
  }
  if (status === "FAILED") {
    return "rose";
  }
  if (status === "PROCESSING" || status === "RUNNING") {
    return "cyan";
  }
  if (status === "PENDING") {
    return "amber";
  }
  return "slate";
}
