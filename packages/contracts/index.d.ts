export type Provider = "gemini" | "openrouter";
export type ModuleId = "documentation" | "audit" | "architecture";
export interface Source {
  uri: string;
  title: string;
}
export interface Project {
  id: string;
  name: string;
  createdAt: string;
}
export interface ArtifactSummary {
  id: string;
  projectId: string;
  sequence: number;
  module: ModuleId;
  format: string;
  title: string;
  provider: Provider;
  model: string;
  status: "DRAFT" | "APPROVED";
  revision?: number;
  updatedAt?: string;
  createdAt: string;
  technicalDocumentId?: string;
}
export interface Artifact extends ArtifactSummary {
  context: string;
  content: string;
  sources: Source[];
}
export interface ArtifactInput {
  projectId: string;
  requestId: string;
  module: ModuleId;
  format: string;
  title: string;
  context: string;
}
export interface ArtifactPage {
  artifacts: ArtifactSummary[];
  hasMore: boolean;
}
export const appVersion: "1.0.0";
export type EvidenceStatus =
  | "proposal"
  | "generated"
  | "read"
  | "compiled"
  | "executed"
  | "tested"
  | "applied"
  | "published";
export interface Receipt {
  kind: "read" | "compile" | "run" | "test" | "apply" | "publish";
  id: string;
  sha256?: string;
  exitCode?: number;
  passed?: number;
  url?: string;
}
export interface Evidence {
  schema: "ares.evidence.v1";
  status: EvidenceStatus;
  scope: string[];
  receipts: Receipt[];
  limitations: string[];
  revision?: string;
}
export const evidenceLabels: Readonly<Record<EvidenceStatus, string>>;
export function createEvidence(
  status: EvidenceStatus,
  scope: string[],
  receipts?: Receipt[],
  limitations?: string[],
  revision?: string,
): Evidence;
export interface PrototypeSource {
  entry: string;
  files: { path: string; content: string }[];
}
export interface PrototypeFile {
  path: string;
  content: string;
  sha256: string;
  bytes: number;
}
export interface PrototypeArtifact {
  id: string;
  revision: string;
  createdAt: string;
  expiresAt: string;
  entry: string;
  compiler: string;
  policy: string;
  files: PrototypeFile[];
  runtime: PrototypeFile;
  evidence: Evidence;
  previewPath: string;
  licenses: PrototypeFile[];
}
export interface PrototypeManifest {
  format: "ares.prototype.v1";
  id: string;
  revision: string;
  entry: string;
  compiler: string;
  policy: string;
  evidence: Evidence;
  files: Pick<PrototypeFile, "path" | "sha256" | "bytes">[];
  licenses: Pick<PrototypeFile, "path" | "sha256" | "bytes">[];
  runtime: Pick<PrototypeFile, "path" | "sha256" | "bytes">;
}
export function prototypeManifest(
  artifact: PrototypeArtifact,
): PrototypeManifest;
export type ScriptName = "check" | "test" | "lint" | "build";
export type RunStatus =
  "RUNNING" | "PASSED" | "FAILED" | "CANCELLED" | "TIMEOUT" | "INTERRUPTED";
export interface FileReference {
  path: string;
  sha256: string;
}
export interface SourceFile extends FileReference {
  content: string;
  bytes: number;
  modifiedAt: string;
  redacted: boolean;
}
export interface FileEntry {
  name: string;
  path: string;
  directory: boolean;
}
export interface FilePage {
  directory: string;
  entries: FileEntry[];
  truncated: boolean;
}
export interface ScriptPreview {
  directory: string;
  manifestHash: string;
  scripts: { name: ScriptName; command: string; runnable: boolean }[];
  runnerAvailable: boolean;
}
export interface ToolRun {
  id: string;
  projectId: string;
  requestId: string;
  directory: string;
  workspacePath: string;
  script: ScriptName;
  manifestHash: string;
  command: string;
  status: RunStatus;
  output: string;
  truncated: boolean;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
}
export interface WorkspaceContext {
  projectId: string;
  sourceRoot: string | null;
  files: (SourceFile & { truncated: boolean })[];
  runs: ToolRun[];
}
export const generationEvents: Readonly<{
  delta: "delta";
  done: "done";
  error: "error";
}>;
export interface RemoteFile {
  path: string;
  sha: string;
  size: number;
  eligible: boolean;
  reason?: string;
}
export interface RemoteTree {
  repository: string;
  url: string;
  ref: string;
  commit: string;
  tree: string;
  files: RemoteFile[];
  listedFiles: number;
  incomplete: boolean;
  limited: boolean;
}
