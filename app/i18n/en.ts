// Copyright (c) 2026 llm-workbench contributors
// SPDX-License-Identifier: MIT

export const en = {
  skipToContent: 'Skip to content',
  nav: {
    appName: 'LLM Workbench',
    compare: 'Compare',
    history: 'History',
    metrics: 'Metrics',
    settings: 'Settings',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    navigationMenu: 'Navigation menu',
    menu: 'Menu',
  },
  mcp: {
    title: 'MCP servers',
    subtitle: 'Connect local or remote Model Context Protocol servers. Auth headers stay in this tab only; they are never written to localStorage.',
    stdioUnavailable: 'stdio MCP needs the Node/Docker API (npm run dev or Docker). GitHub Pages can still use HTTP/SSE servers directly.',
    name: 'Name',
    namePlaceholder: 'Filesystem',
    transport: 'Transport',
    url: 'URL',
    command: 'Command',
    args: 'Arguments',
    authHeader: 'Authorization header (optional)',
    authPlaceholder: 'Bearer …',
    authHint: 'Session-only. Not persisted with the server list.',
    add: 'Add server',
    enabled: 'Enabled',
    refresh: 'Refresh tools',
    tools: 'Tools',
    noTools: 'none yet — click Refresh tools',
    runLive: 'Run live MCP',
    inspection: 'MCP call',
  },
}

export type Messages = typeof en
