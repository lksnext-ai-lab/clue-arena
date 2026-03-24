'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { type PublicConfig, fetchRuntimeConfig, getStaticConfig } from '@/lib/runtime-config';

const RuntimeConfigContext = createContext<PublicConfig>(getStaticConfig());

/**
 * RuntimeConfigProvider — must wrap the entire client tree (place in root layout).
 *
 * Renders immediately with build-time values (static), then updates once after
 * /api/config resolves with values from the running pod's environment (dynamic).
 * The Promise is cached at module level in runtime-config.ts so there is only
 * one network request regardless of how many providers are mounted.
 */
export function RuntimeConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicConfig>(getStaticConfig);

  useEffect(() => {
    void fetchRuntimeConfig().then(setConfig);
  }, []);

  return <RuntimeConfigContext.Provider value={config}>{children}</RuntimeConfigContext.Provider>;
}

/** Returns the current runtime config. Re-renders when the dynamic config loads. */
export function useRuntimeConfig(): PublicConfig {
  return useContext(RuntimeConfigContext);
}
