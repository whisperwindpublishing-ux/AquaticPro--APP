"use client";

import { useState, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { UserPermissions } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";

export interface MeData {
  user: SessionUser;
  permissions: UserPermissions;
}

interface PermissionsState {
  data: MeData | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Returns the current user's resolved permissions.
 * Fetches /api/me (Redis-cached server-side for 5 min).
 * Replaces window.mentorshipPlatformData.isAdmin and .enabledModules.
 */
export function usePermissions(): PermissionsState {
  const [state, setState] = useState<PermissionsState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    apiClient
      .get<MeData>("/api/me")
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) =>
        setState({ data: null, loading: false, error: err as ApiError }),
      );
  }, []);

  return state;
}
