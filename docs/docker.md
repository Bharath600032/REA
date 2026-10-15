# Docker

[`docker/Dockerfile`](https://github.com/morluto/rea/blob/main/docker/Dockerfile)
builds a Linux x64 image containing REA, a 64-bit full JDK 21, Ghidra 12.1.4,
the pinned [JADX engine](android-analysis.md) and a Chromium-family browser.
Use it to keep untrusted targets away from your host, or to use the Linux
providers from a Windows or macOS host through Docker Desktop.

The container is an isolation boundary for the target files you mount, not a
sandbox for anything those targets contact. Browser pages still reach the
network, and anything you mount writable can be changed.

## Build

From a checkout of this repository:

```bash
docker build --platform linux/amd64 -t rea docker/
```

`--platform linux/amd64` keeps the supported x64 image on ARM64 hosts such as
Apple silicon, where Docker runs it under emulation. That combination has not
been verified.

The build downloads Ghidra, the JADX JAR (checked against its pinned SHA-256),
the `rea-agents` npm package and Playwright's Chrome for Testing build. The
image runs as an unprivileged `rea` user, with `/targets` as its working
directory.

Check the native provider:

```bash
docker run --rm rea doctor --provider ghidra
```

Check the JADX installation:

```bash
docker run --rm rea doctor --provider jadx
```

This validates the JADX JAR and the Java runtime REA would launch. It does not
check whether the JADX heap is large enough for a given APK (see
[Memory](#memory)). To test Android analysis end to end, run an
[Android command](android-analysis.md) against an APK.

## Register with an agent

The image's default command is `rea mcp`. Docker must keep stdin open, so pass
`-i`. For Claude Code:

```bash
claude mcp add --scope local rea -- docker run -i --rm --memory 3g -e GHIDRA_HEADLESS_MAXMEM=2G -v /absolute/host/targets:/targets:ro rea
```

Other clients use the same command and arguments in their
[manual MCP registration](installation.md#mcp-registry). On Windows, write the
host path with forward slashes, for example `C:/work/targets:/targets:ro`.

With `--rm`, each agent session starts a new container, and Docker removes it
when the session ends. When no session is running, Docker Desktop lists the
`rea` image but no container.

## Targets and paths

REA sees only the paths that exist inside the container. Mount the directory
holding your targets, read-only where possible, and give the agent container
paths such as `/targets/app.apk`, not host paths.

Ghidra imports targets into a temporary project, so Ghidra analysis works on a
read-only mount. Commands that export files need a writable directory: mount a
separate output directory for those, and leave the targets read-only.

## Memory

Ghidra's JVM can take a large share of the Docker VM's memory. Set a container
limit and a smaller Ghidra heap, as in the registration above:

```bash
docker run --rm --memory 3g -e GHIDRA_HEADLESS_MAXMEM=2G -v /absolute/host/targets:/targets:ro rea function /targets/program main --provider ghidra
```

See [installation](installation.md) for the other Ghidra memory settings.

JADX gets no heap setting from REA. Inside a container, Java's default heap is
a quarter of the container limit, so `--memory 3g` leaves JADX about 768 MiB.
That is enough for small APKs. A large APK can then fail during load with
`load failed: Java heap space`; a 74 MB APK with about 28,000 classes did. Raise
the container limit and set the JADX heap explicitly:

```bash
docker run --rm --memory 6g -e REA_JADX_HEAP_MIB=4096 -v /absolute/host/targets:/targets:ro rea inspect-android-package /targets/app.apk
```

Keep the heap below the container limit, because the JVM also uses native
memory. See [Android analysis](android-analysis.md) for `REA_JADX_HEAP_MIB` and
the other JADX settings.

## Browsers

The image sets `REA_BROWSER_EXECUTABLE` to its Chromium build. It also sets
`REA_BROWSER_NO_SANDBOX=true`, because Chromium's sandbox needs user
namespaces, and Docker's default seccomp profile blocks them. Without
`--no-sandbox`, Chromium exits with `No usable sandbox!`. Inspect only sites
you are prepared to load in an unsandboxed browser inside this container.

[CDP observation](browser-observation.md) attaches to a browser that is
already running with a loopback debugging port. REA does not launch that
browser. A `docker run -i --rm` container has no such browser, so for CDP work
start one long-running container and connect the agent with `docker exec`:

```bash
docker run -d --name rea-session --memory 3g -e GHIDRA_HEADLESS_MAXMEM=2G -v /absolute/host/targets:/targets:ro --entrypoint sh rea -c 'chromium --headless=new --no-sandbox --password-store=basic --remote-debugging-port=9222 --user-data-dir=/tmp/rea-browser-profile about:blank & exec sleep infinity'
```

```bash
claude mcp add --scope local rea -- docker exec -i rea-session rea mcp
```

The agent then uses `http://127.0.0.1:9222` as the CDP endpoint. The port stays
inside the container. Stop it with `docker rm -f rea-session` when the
investigation is complete.

## Limits

- The image targets Linux x64. Linux ARM64 also needs Ghidra's native
  decompiler built for that platform; see [installation](installation.md).
- Hopper, IDA and JEB are not included. Native analysis in the image uses
  Ghidra.
- Apple tooling and other host-specific providers
  remain unavailable in a Linux container. Windows and macOS binaries can still
  be analysed statically with Ghidra.
- Firmware, packet and signal tools (Binwalk, Unblob, TShark, sigrok) are not
  installed. Add them to a derived image when you need them.

## Update

The Dockerfile pins the `rea-agents` release it was published with. Pull the
repository and rebuild with `docker build --pull --platform linux/amd64 -t rea docker/` to pick up
a newer release and base images.
