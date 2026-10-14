import { chmod, readFile, writeFile, rename } from "node:fs/promises";
import { expect, onTestFinished, test } from "vitest";
import { AdbProvider } from "../../../../src/adb/AdbProvider.js";
import { parseAdbUiReply } from "../../../../src/adb/AdbUiRunner.js";
import { AdbDeviceAnalysisService } from "../../../../src/application/adb/AdbDeviceAnalysisService.js";
import { toolContract } from "../../../../src/contracts/toolContracts.js";
import {
  createTestWorkspace,
  removeTestWorkspace,
} from "../../../support/workspace/workspaceFixture.js";

const it = test.skipIf(process.platform === "win32");
const instance = "00000000-0000-4000-8000-000000000001";
const snapshotId = "00000000-0000-4000-8000-000000000002";
const scope = { serial: "emulator-5554", package: "com.example.app" };
const runner = {
  package_name: "dev.rea.uiautomator",
  instance_id: instance,
  version: "0.1.0",
  ui_automator_version: "2.4.0",
  sdk_int: 36,
};
const bounds = { left: 0, top: 0, right: 100, bottom: 50 };
const node = {
  id: "0",
  parent_id: null,
  window_id: 1,
  package_name: scope.package,
  class_name: "android.widget.Button",
  resource_id: "com.example.app:id/go",
  text: "Hello 世界",
  content_description: null,
  bounds,
  visible_bounds: bounds,
  enabled: true,
  clickable: true,
  long_clickable: true,
  editable: false,
  scrollable: false,
  focused: false,
  selected: false,
  checked: false,
  checkable: false,
  password: false,
  text_redacted: false,
  content_description_redacted: false,
  visible: true,
  click_target_id: "0",
};
const header = {
  id: snapshotId,
  captured_at_ms: 1,
  package_name: scope.package,
  display_id: 0,
  window_id_filter: null,
  foreground_package: scope.package,
  windows: [{ id: 1, display_id: 0, active: true, focused: true, bounds }],
  examined_nodes: 1,
  retained_nodes: 1,
  coverage: "complete",
  limitations: [],
};

async function fixture(mode: Record<string, unknown> = {}) {
  const workspace = await createTestWorkspace("rea-ui-transport-");
  const config = workspace.path("mode.json");
  await writeFile(config, JSON.stringify(mode));
  const binary = await workspace.write(
    "adb",
    `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const args = process.argv.slice(2);
if(args[0] === 'version') {
  console.log('Android Debug Bridge version 1.0.41\\nVersion 34.0.5-ui-fixture\\nInstalled as ' + __filename);
  process.exit(0);
}
if(args[0] !== '-s' || args[2] !== 'shell' || args[3] !== 'am' || args[4] !== 'broadcast' || args[5] !== '--receiver-foreground' || args[6] !== '--user' || args[7] !== '0' || args[8] !== '-a' || args[10] !== '-p' || args[12] !== '--es' || args[13] !== 'request' || args.length !== 15) throw new Error('unmodeled adb command');
const request = JSON.parse(Buffer.from(args[14], 'base64').toString('utf8'));
const mode = JSON.parse(fs.readFileSync(path.join(root, 'mode.json'), 'utf8'));
fs.appendFileSync(path.join(root, 'calls'), JSON.stringify({operation:request.operation,request_id:request.request_id,cancel_request_id:request.cancel_request_id})+'\\n');
const runner = ${JSON.stringify(runner)};
const node = ${JSON.stringify(node)};
const snapshot = ${JSON.stringify(header)};
const frame = (id,result,error=null) => ({protocol:1,request_id:id,instance_id:runner.instance_id,ok:error===null,result,error});
const reply = result => console.log('Broadcast completed: result=0, data="REA_UI_V1:' + Buffer.from(JSON.stringify(frame(request.request_id,result))).toString('base64') + '"');
const jobFile = id => path.join(root, 'job-' + id + '.json');
if (request.operation === 'ping') {
  if(mode.kind === 'unavailable') console.log('Broadcast completed: result=0');
  else reply(runner);
} else if (request.operation === 'cancel') {
  if(mode.cancel_offline) { console.error('device offline'); process.exit(1); }
  fs.rmSync(path.join(root, 'active'), {force:true});
  const file=jobFile(request.cancel_request_id);
  let response=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  if(response?.state==='running') response=frame(request.cancel_request_id,null,{kind:'cancelled',reason:'UI request cancelled'});
  if(response!==null) fs.writeFileSync(file,JSON.stringify(response));
  reply({state:response===null?'missing':'settled',response});
} else if (request.operation === 'forget') {
  if(mode.forget_offline) { console.error('device offline'); process.exit(1); }
  fs.rmSync(jobFile(request.target_request_id),{force:true}); reply({state:'forgotten'});
} else if (request.operation === 'status') {
  const file=jobFile(request.target_request_id);
  const response=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  if(mode.status_capacity) console.log('Broadcast completed: result=1, data="REA_UI_V1:' + Buffer.from(JSON.stringify(frame(request.request_id,null,{kind:'capacity',reason:'Response exceeds the Binder transport budget'}))).toString('base64')+'"');
  else if(response?.state==='running') setInterval(()=>{},1000);
  else reply({state:response===null?'missing':'settled',response});
} else {
  if(mode.kind === 'wrong-package') snapshot.package_name = 'com.other.app';
  let result;
  if(request.operation === 'inspect_adb_ui') result={runner,snapshot:{...snapshot,nodes:[node]}};
  else if(request.operation === 'find_adb_ui_elements') result={runner,snapshot,matches:[node],related_nodes:[],total_matches:1,offset:0,next_offset:null,coverage:'complete',freshness:'captured'};
  else if(request.operation === 'perform_adb_ui_action') {
    node.password = Boolean(mode.password); node.text_redacted = node.password; if(node.password) node.text=null;
    result={runner,before:snapshot,selected_element:node,dispatch_attempted:true,action_completed:true,action_error:null,text_verified:true,can_scroll_more:null,after:null,observation_failure:null};
  } else if(request.operation !== 'wait_for_adb_ui' || mode.kind !== 'hang') throw new Error('unmodeled UI operation');
  if(mode.kind==='hang') {
    fs.writeFileSync(path.join(root,'active'),request.request_id);
    fs.writeFileSync(jobFile(request.request_id),JSON.stringify({state:'running'}));
  } else fs.writeFileSync(mode.kind==='delayed' ? path.join(root,'delayed-'+request.request_id) : jobFile(request.request_id),JSON.stringify(frame(request.request_id,result)));
  if(mode.kind === 'wrong-id') request.request_id = '00000000-0000-4000-8000-000000000099';
  if(mode.kind==='malformed' || mode.kind==='delayed') console.log('Broadcast completed: result=0, data="REA_UI_V1:not-json"');
  else reply({state:'accepted'});
}
`,
  );
  await chmod(binary, 0o755);
  const provider = new AdbProvider({
    environment: {
      ...process.env,
      ...workspace.environment,
      REA_ADB_PATH: binary,
    },
  });
  const service = new AdbDeviceAnalysisService(provider);
  onTestFinished(async () => {
    await writeFile(config, "{}");
    await provider.close();
    await removeTestWorkspace(workspace.root);
  });
  return {
    workspace,
    provider,
    service,
    setMode: (next: Record<string, unknown>) =>
      writeFile(config, JSON.stringify(next)),
  };
}

it("projects a real subprocess reply through the named UI contract and preserves Unicode", async () => {
  const { service } = await fixture();
  const outcome = await service.execute("find_adb_ui_elements", {
    ...scope,
    selector: { text: { value: "Hello 世界" } },
  });
  if (!outcome.ok) throw outcome.error;
  const evidence = toolContract("find_adb_ui_elements").outputSchema.parse(
    outcome.value,
  );
  expect(evidence.authority).toBe("controlled-replay");
  expect(evidence.normalized_result.matches[0]?.text).toBe("Hello 世界");
  expect(evidence.normalized_result.runner.instance_id).toBe(instance);
  expect(evidence.parameters).toMatchObject({
    selector: { text: { value: "Hello 世界", match: "exact" } },
  });
});

it.each(["unavailable", "malformed", "wrong-id", "wrong-package"])(
  "refuses %s producer state without presenting it as UI evidence",
  async (kind) => {
    const { service } = await fixture({ kind });
    const result = await service.execute("inspect_adb_ui", scope);
    if (result.ok) throw new Error("Expected a boundary refusal");
    expect(result.error._tag).toBe(
      kind === "unavailable"
        ? "AnalysisCapabilityUnavailableError"
        : "AnalysisProtocolError",
    );
  },
);

it("redacts explicit sensitive inputs and producer-marked password controls without changing ordinary text", async () => {
  const { service, setMode } = await fixture();
  for (const [sensitive, password, expected] of [
    [false, false, "token=caller-value"],
    [true, false, "[redacted]"],
    [false, true, "[redacted]"],
  ] as const) {
    await setMode({ password });
    const result = await service.execute("perform_adb_ui_action", {
      ...scope,
      snapshot_id: snapshotId,
      element_id: "0",
      action: { kind: "set_text", text: "token=caller-value", sensitive },
    });
    if (!result.ok) throw result.error;
    expect(result.value.parameters).toMatchObject({
      action: { text: expected, sensitive },
    });
  }
});

it("cancels only the owned remote request after host command settlement", async () => {
  const { service, workspace } = await fixture({ kind: "hang" });
  const controller = new AbortController();
  const pending = service.execute(
    "wait_for_adb_ui",
    { ...scope, selector: {}, timeout_ms: 30000 },
    { signal: controller.signal },
  );
  await expect
    .poll(() => readFile(workspace.path("active"), "utf8"))
    .toMatch(/^[a-f0-9-]{36}$/u);
  const activeId = await readFile(workspace.path("active"), "utf8");
  controller.abort();
  const result = await pending;
  if (result.ok) throw new Error("Expected cancellation");
  expect(result.error._tag).toBe("AnalysisCancelledError");
  const calls = (await readFile(workspace.path("calls"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(calls.filter((call) => call.operation === "cancel")).toEqual([
    expect.objectContaining({ cancel_request_id: activeId }),
  ]);
  await expect(readFile(workspace.path("active"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("retains failed remote cleanup for a later close retry", async () => {
  const { service, provider, workspace, setMode } = await fixture({
    kind: "hang",
    cancel_offline: true,
  });
  const controller = new AbortController();
  const pending = service.execute(
    "wait_for_adb_ui",
    { ...scope, selector: {} },
    { signal: controller.signal },
  );
  await expect
    .poll(() => readFile(workspace.path("active"), "utf8"))
    .toMatch(/^[a-f0-9-]{36}$/u);
  controller.abort();
  const result = await pending;
  if (result.ok) throw new Error("Expected retained cleanup failure");
  expect(result.error.cleanupResources.length).toBeGreaterThan(0);
  await setMode({});
  await provider.close();
  expect(result.error.cleanupIncomplete).toBe(false);
  await expect(readFile(workspace.path("active"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("preserves a completed observation when acknowledgement fails and resolves cleanup on retry", async () => {
  const { service, provider, setMode } = await fixture({
    forget_offline: true,
  });
  const result = await service.execute("inspect_adb_ui", scope);
  if (result.ok) throw new Error("Expected acknowledgement cleanup failure");
  expect(result.error.partialObservation).toMatchObject({
    provider_id: "adb",
    operation: "inspect_adb_ui",
    result: {
      snapshot: {
        id: snapshotId,
        nodes: [expect.objectContaining({ text: "Hello 世界" })],
      },
    },
  });
  expect(result.error.cleanupIncomplete).toBe(true);
  await setMode({});
  await provider.close();
  expect(result.error.cleanupIncomplete).toBe(false);
});

it("keeps an unobserved submission owned until delayed delivery can be reconciled", async () => {
  const { service, provider, workspace, setMode } = await fixture({
    kind: "delayed",
  });
  const result = await service.execute("inspect_adb_ui", scope);
  if (result.ok) throw new Error("Expected uncertain delivery");
  expect(result.error.cleanupIncomplete).toBe(true);
  const calls = (await readFile(workspace.path("calls"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(calls.some((call) => call.operation === "forget")).toBe(false);
  const request = calls.find((call) => call.operation === "inspect_adb_ui");
  await rename(
    workspace.path(`delayed-${request.request_id}`),
    workspace.path(`job-${request.request_id}.json`),
  );
  await setMode({});
  await provider.close();
  expect(result.error.cleanupIncomplete).toBe(false);
});

it("settles a result-transport capacity refusal while preserving recovered facts", async () => {
  const { service } = await fixture({ status_capacity: true });
  const result = await service.execute("inspect_adb_ui", scope);
  if (result.ok) throw new Error("Expected transport capacity refusal");
  expect(result.error._tag).toBe("AnalysisResourceConstraintError");
  expect(result.error.cleanupIncomplete).toBe(false);
  expect(result.error.partialObservation).toMatchObject({
    operation: "inspect_adb_ui",
    result: { snapshot: { id: snapshotId } },
  });
});

test("rejects malformed, duplicate and oversized terminal records before accepting UI data", () => {
  for (const value of [
    "",
    'Broadcast completed: result=0, data="REA_UI_V1:%%%%"',
    "Broadcast completed: result=0\nBroadcast completed: result=0",
    `Broadcast completed: result=0, data="REA_UI_V1:${"A".repeat(360000)}"`,
  ]) {
    expect(parseAdbUiReply(value).ok).toBe(false);
  }
});
