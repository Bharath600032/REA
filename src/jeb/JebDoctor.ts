import type { DoctorProviderInspection } from "../application/Doctor.js";
import type { AnalysisError } from "../domain/analysisErrorBase.js";
import { parseJebMcpEndpoint } from "./JebMcpEndpoint.js";

/** Check the endpoint registration without launching JEB, and retain only the caller-selected endpoint. */
export const inspectJebRegistration = (
  value: string | undefined,
): DoctorProviderInspection => {
  const configured = value !== undefined && value.length > 0;
  const parsed = configured ? parseJebMcpEndpoint(value) : undefined;
  const valid = parsed?.ok === true;
  return {
    id: "jeb",
    configured,
    available: valid,
    providerVersion: null,
    registrationEnvironment:
      valid && configured && value !== undefined
        ? { REA_JEB_MCP_URL: value }
        : {},
    checks: [
      {
        name: "registration",
        ok: valid,
        code: valid
          ? null
          : configured
            ? "invalid_configuration"
            : "not_configured",
        detail: valid
          ? "JEB MCP endpoint is valid. Upstream availability, compatibility, and project binding are checked when analysis starts; no JEB process was launched."
          : parsed !== undefined && !parsed.ok
            ? `JEB MCP endpoint is invalid: ${endpointConstraint(parsed.error)}.`
            : "JEB MCP endpoint is not configured.",
        remediation: valid
          ? null
          : "Set REA_JEB_MCP_URL to your running JEB MCP endpoint; see docs/jeb-analysis.md.",
        classification: configured ? "config_drift" : "missing_analysis_engine",
      },
    ],
  };
};

const endpointConstraint = (error: AnalysisError): string =>
  typeof error.cause === "string" && error.cause.length > 0
    ? error.cause
    : error.message;
