# REA UI Automator runner

This source-built, operator-owned instrumentation APK supplies the Android UI
backend described in [the UI guide](../../docs/adb-ui-automation.md). It pins
AndroidX UI Automator 2.4.0 and uses its public window, node and gesture APIs.
It needs JDK 17, Gradle 8.9, Android SDK 35 and build-tools 34.0.0.

```sh
gradle -p bridge/adb-ui assembleDebug
```

`-PreaBuildDir=/absolute/output` selects a separate build directory. The APK is
built locally and installed through the existing explicit ADB installation tool.
The instrumentation targets its own package and observes other apps' accessible
UI, including release apps; it does not inject code into those target processes.

Protocol v1 uses package-scoped, user-0 broadcasts protected by
`android.permission.DUMP`. Submission returns immediately; status, cancellation
and acknowledgement are separate bounded messages. The receiver remains able to
cancel a running operation. One worker owns UI operations and the most recent
snapshot. Retained results and sensitive-value state have explicit capacities.

The operator owns start/stop and APK installation. Host REA sessions own their
individual requests, not the instrumentation process. No permission-dialog
watcher, arbitrary shell command or caller-authored code is exposed by the bridge.

UI Automator and AndroidX Test are Android Open Source Project components under
Apache-2.0. Their dependencies retain their own licenses, including Kotlin,
JUnit, Hamcrest and Guava. Gradle obtains these separately for the operator-built
APK; preserve the upstream notices when redistributing that artifact. See
[third-party notices](../../THIRD_PARTY_NOTICES.md) and the
[UI Automator release page](https://developer.android.com/jetpack/androidx/releases/test-uiautomator#2.4.0).
