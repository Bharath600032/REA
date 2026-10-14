import { snapshotEnvironment } from "../process/snapshotEnvironment.js";
import type { AppConfig } from "../config/types.js";
import type { BinarySession } from "../application/binary/BinarySession.js";
import { assertBinaryLaneProviderIds } from "../application/binary/BinaryProviderIds.js";
import { HopperProvider } from "../hopper/HopperProvider.js";
import { GhidraProvider } from "../ghidra/GhidraProvider.js";
import { IdaProvider } from "../ida/IdaProvider.js";
import type { Logger } from "pino";
import { auxiliaryAnalysisProviderDeclarations } from "./auxiliaryAnalysisProviders.js";
import { AnalysisProviderRegistry } from "../application/binary/AnalysisProviderRegistry.js";
import { composeBinarySession } from "../application/binary/BinarySessionComposition.js";
import { LazyAnalysisProvider } from "../application/binary/LazyAnalysisProvider.js";
import { ManagedStaticProvider } from "../dotnet/ManagedStaticProvider.js";

/**
 * Compose the target-switching runtime shared directly by CLI and MCP adapters.
 * This is the sole production wiring point, so both adapters share identical
 * provider selection, profile, lifecycle, and Evidence semantics.
 *
 * The binary lane membership (`hopper`, `ghidra`, `ida`) is published for
 * startup-safe consumers as `BINARY_ANALYSIS_PROVIDER_IDS` in
 * `application/binary/BinaryProviderIds.ts`, and the wiring below is
 * validated against it so the two cannot drift silently.
 */
export const createBinarySession = (
  config: AppConfig,
  logger: Logger,
  selectedEnvironment: Readonly<NodeJS.ProcessEnv>,
): BinarySession => {
  const environment = snapshotEnvironment(selectedEnvironment);
  const hopper = new HopperProvider(config, logger, environment);
  const ghidra = new GhidraProvider(config, logger, environment);
  const ida = new IdaProvider(config, environment);
  const laneProviders = [hopper, ghidra, ida];
  assertBinaryLaneProviderIds(
    laneProviders.map((provider) => provider.identity().id),
  );
  return composeBinarySession(
    new AnalysisProviderRegistry(laneProviders, config.analysisProvider),
    auxiliaryAnalysisProviderDeclarations(environment).map(
      (declaration) => new LazyAnalysisProvider(declaration),
    ),
  );
};

/** Compose an execution-free managed session without native provider selection. */
export const createManagedBinarySession = (): BinarySession =>
  composeBinarySession(new AnalysisProviderRegistry([]), [
    new ManagedStaticProvider(),
  ]);

/** Compose the artifact operations without candidates for deep analysis engines. */
export const createArtifactBinarySession = (
  selectedEnvironment: Readonly<NodeJS.ProcessEnv>,
  platform: NodeJS.Platform = process.platform,
): Promise<BinarySession> =>
  import("../artifacts/ArtifactProvider.js").then(({ ArtifactProvider }) =>
    composeBinarySession(new AnalysisProviderRegistry([]), [
      new ArtifactProvider(
        snapshotEnvironment(selectedEnvironment, platform),
        platform,
      ),
    ]),
  );
