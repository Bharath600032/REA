# Android UI discovery and actions

REA exposes Android UI Automator 2.4 through the same CLI/MCP ADB service. Find
text and controls, inspect their attributes, select an element, perform one
action, and observe the result. The runner operates outside the target app's
process and uses its accessibility-exposed UI.

## Prepare the runner

Supply adb, JDK 17, Gradle 8.9, Android SDK platform 35 and build-tools 34.0.0.
The source project pins Android Gradle Plugin 8.7.3 and UI Automator 2.4.0.
Gradle resolves the declared AndroidX dependencies from Google Maven/Maven Central.

From a source checkout or an installed package containing the bridge sources:

```sh
gradle -p bridge/adb-ui assembleDebug
rea install-adb-package emulator-5554 \
  bridge/adb-ui/build/outputs/apk/debug/rea-uiautomator-runner-debug.apk
adb -s emulator-5554 shell am instrument --user 0 -w \
  dev.rea.uiautomator/dev.rea.uiautomator.ReaUiRunner
```

Keep that instrumentation command running in a terminal. `REA_UI_READY` identifies
the new runner instance. The operator owns its installation and lifetime. REA
contacts the existing runner through short, package-scoped broadcasts for Android
user 0; its receiver requires the shell's `android.permission.DUMP` permission.
The helper preserves other accessibility services with
`FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` and registers no automatic dialog handlers.

`REA_ADB_PATH` selects adb as usual. `REA_ADB_UI_PACKAGE` can select a compatible,
operator-built runner package; the default is `dev.rea.uiautomator`. An unavailable
runner reports its setup requirement. Use the existing app-lifecycle tools to
launch the target application.

## Find text and buttons

CLI commands take the corresponding MCP input as inline JSON or a local JSON
file path. For example:

```sh
rea find-adb-ui-elements '{"serial":"emulator-5554","package":"com.example.app","selector":{"text":{"value":"Sign in","match":"exact"}}}' --json
rea find-adb-ui-elements '{"serial":"emulator-5554","package":"com.example.app","selector":{"clickable":true,"enabled":true,"visible":true}}' --json
rea inspect-adb-ui '{"serial":"emulator-5554","package":"com.example.app"}' --json
```

Selectors combine text, content description, resource ID, class name, ancestor
resource ID and observed states. Text matching is case-sensitive and supports
`exact` or `contains`. An empty selector inventories the captured scope. Omitted
states mean no filter; `enabled: false` specifically selects disabled controls.

Results preserve all observed matches, including duplicate labels. Each match
has a snapshot-scoped `id`, raw and UI Automator-visible bounds, package/class
and resource IDs, text and descriptions, state flags and parent identity.
`click_target_id` derives the nearest clickable ancestor (or the element itself);
`related_nodes` supplies that parent's facts when the label is a child node.
An enabled/clickable flag describes the observation, not a guaranteed outcome.

`snapshot.id` belongs to one runner instance. A new capture replaces its previous
snapshot; actions retire their input snapshot and attempt an after-capture.
Use `snapshot_id` with `next_offset` to page matches from that exact retained
observation. Such pages report `freshness: retained_snapshot`, not live freshness.
Repeat the package, display and optional window scope when using a retained ID.

## Act on a selected element

Use the returned snapshot and element IDs:

```sh
rea perform-adb-ui-action '{"serial":"emulator-5554","package":"com.example.app","snapshot_id":"00000000-0000-4000-8000-000000000001","element_id":"7","action":{"kind":"tap"}}' --json
rea wait-for-adb-ui '{"serial":"emulator-5554","package":"com.example.app","selector":{"text":{"value":"Saved","match":"exact"}},"condition":"present","timeout_ms":10000}' --json
```

Replace the example IDs with the actual discovery result. The primitives are:

| `action.kind` | Additional fields                 | Meaning                                                              |
| ------------- | --------------------------------- | -------------------------------------------------------------------- |
| `tap`         | —                                 | Click the selected visible element                                   |
| `double_tap`  | —                                 | Two clicks on the selected element                                   |
| `long_press`  | —                                 | UI Automator long click                                              |
| `set_text`    | `text`, optional `sensitive`      | Accessibility text replacement; empty text clears it                 |
| `scroll`      | `direction`, `percent`            | Scroll an observed scrollable control                                |
| `swipe`       | `direction`, `percent`            | Swipe inside the selected element                                    |
| `drag`        | `destination_id`                  | Drag to another observed element in the same window                  |
| `key_event`   | `key_code`, optional `meta_state` | Send a key to the foreground package on display 0; omit `element_id` |

Directions are `up`, `down`, `left` or `right`; percent is greater than zero and
at most one. Refresh checks reject changed element facts, disabled/invisible
targets and inactive windows. No first matching element is silently chosen.
Snapshots and input dispatch are sequential, so UI changes between observations
remain possible.

`dispatch_attempted` and `action_completed` describe the provider call. A click
returning does not prove that navigation, saving or another app outcome occurred.
Use the after-snapshot or an explicit wait to verify that outcome. Text replacement
also reports its immediate readback, and scrolling retains UI Automator's own
`can_scroll_more` result. Overlays or the input keyboard can intercept gestures;
that return value alone does not prove the end of a list. Handle a known visible
keyboard explicitly (for example, a BACK key event) and verify the after-state.
Input can change app data, permissions and network state;
application state is left as-is.

## Coverage, privacy and lifecycle

- Scope is accessibility-visible windows for the selected package/display, with
  an optional window filter. Custom canvas content and unmaterialized off-screen
  items can be absent from this interface. Coverage is of examined accessibility
  data, not every visually drawn pixel or every screen in the application.
- Capture reports examined/retained node counts, partial coverage and reasons.
  The caller's node budget defaults to 500. Pending native node handles and
  retained facts also share a budget derived from reply capacity. The Binder reply
  budget can be reached sooner; its 256 KiB JSON ceiling accounts for base64 and
  Binder's UTF-16 string expansion. Requests have a 16 KiB JSON budget before
  base64 encoding to fit supported host command-line limits.
- Password-marked text is excluded. `set_text` with `sensitive: true` redacts that
  action's recorded parameter; the runner also omits UI text and description
  fields containing that literal value for its lifetime. Its bounded sensitive-value store refuses
  additional values when full rather than evicting earlier redactions. Search
  predicates involving redacted text report partial query coverage. A wait cannot
  claim absence from incomplete or hidden matching facts.
- Runtime observations use `controlled-replay` Evidence authority and preserve
  the caller-selected device, scope and runner-reported identity. No association
  with a local APK's bytes is established by an equal package name.
- Work is acknowledged immediately, then polled by request ID. Long UI waits do
  not hold an ordered broadcast open and block cancellation. Replies remain
  retained until acknowledged; at most 16 unacknowledged requests are admitted.
- Cancellation settles host commands, cancels only the owned remote request,
  waits for its work to settle and acknowledges its retained result. A separate
  five-second cleanup budget applies. Completed facts survive acknowledgement
  failures as partial observations. Failed cleanup retains exact request/runner
  identities for later retry; another runner instance cannot prove old cleanup.
  A missing request after interrupted submission is unresolved delivery, not
  proof of cancellation; cleanup retains it until delivery can be reconciled.

End the operator-owned runner explicitly when finished:

```sh
rea stop-adb-app emulator-5554 dev.rea.uiautomator
rea uninstall-adb-package emulator-5554 dev.rea.uiautomator
```

## Verification

The public workflow is exercised by `experiments/adb-ui/verify.mjs` against a
source-built probe: text/button discovery, duplicate-label paging, clickable
ancestors, eight primitives, Unicode, sensitive text, stale/disabled refusals,
waits, cancellation, CLI/MCP snapshot parity and fixture cleanup. The Compose
fixture and `verify-compose.mjs` exercise virtual/merged accessibility nodes.
Provider-boundary tests separately exercise malformed replies, request identity,
unavailable runners, cancellation and acknowledgement/cleanup failure.

The runner's source minimum is API 24; secondary-display inspection requires
API 30. Real verification and platform-specific limitations are recorded in the
experiment README. The protocol targets the user-0 runner; other Android-user
configurations and host/platform combinations need their own verification.
