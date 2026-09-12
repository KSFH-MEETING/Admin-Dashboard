'use client';

import { useEffect, useRef } from 'react';

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: WebMcpTool & { execute: (input: unknown) => unknown }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

export function useWebMcpTool(tool: WebMcpTool, execute: (input: unknown) => unknown, enabled = true) {
  const executeRef = useRef(execute);
  useEffect(() => { executeRef.current = execute; }, [execute]);

  useEffect(() => {
    const context = document.modelContext;
    if (!enabled || !context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({ ...tool, execute: (input) => executeRef.current(input) }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch { /* WebMCP is optional in browsers that do not support it. */ }
    return () => lifecycle.abort();
  }, [tool, enabled]);
}
