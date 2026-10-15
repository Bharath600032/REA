# REA in a Linux container: Node, JDK 21, Ghidra, the pinned JADX engine and
# a Chromium-family browser. See docs/docker.md.
FROM eclipse-temurin:21-jdk-noble

# Node 24 (REA requires 22.x >=22.19, 24.x >=24.11, or 26+).
COPY --from=node:24-bookworm-slim /usr/local/bin/node /usr/local/bin/
COPY --from=node:24-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && apt-get update \
 && apt-get install -y --no-install-recommends procps unzip curl \
 && rm -rf /var/lib/apt/lists/*

# Ghidra 12.1.4, the release REA's bridge is verified against.
RUN curl -fsSL -o /tmp/ghidra.zip https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.4_build/ghidra_12.1.4_PUBLIC_20260921.zip \
 && unzip -q /tmp/ghidra.zip -d /opt \
 && mv /opt/ghidra_12.1.4_PUBLIC /opt/ghidra \
 && rm /tmp/ghidra.zip
ENV GHIDRA_INSTALL_DIR=/opt/ghidra

# JADX engine pinned by docs/android-analysis.md.
RUN mkdir -p /opt/jadx \
 && curl -fsSL -o /opt/jadx/jadx-headless-mcp-0.7.1-all.jar https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/jadx-headless-mcp-0.7.1-all.jar \
 && echo '6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75  /opt/jadx/jadx-headless-mcp-0.7.1-all.jar' | sha256sum -c -
ENV REA_JADX_MCP_JAR=/opt/jadx/jadx-headless-mcp-0.7.1-all.jar

# x-release-please-start-version
RUN npm install -g rea-agents@6.5.0
# x-release-please-end

# Chromium build for the playwright-core version rea-agents installed, so a
# release that updates Playwright also updates the browser. Ubuntu's chromium
# package installs through snap, which does not run in a container.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN node /usr/local/lib/node_modules/rea-agents/node_modules/playwright-core/cli.js install --with-deps chromium \
 && ln -s "$(find /opt/ms-playwright -path '*chrome-linux*/chrome' -type f | head -1)" /usr/local/bin/chromium \
 && chmod -R a+rX /opt/ms-playwright
ENV REA_BROWSER_EXECUTABLE=/usr/local/bin/chromium
# Chrome's sandbox needs user namespaces, which Docker's default seccomp
# profile blocks. The container is the isolation boundary instead.
ENV REA_BROWSER_NO_SANDBOX=true

RUN useradd -m rea
USER rea
WORKDIR /targets
ENTRYPOINT ["rea"]
CMD ["mcp"]
