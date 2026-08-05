import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { api } from "../lib/apiClient";
import { useAuth } from "./AuthContext";

/*
 * =========================================================
 * ORGANIZATION CONTEXT (D-20)
 * =========================================================
 *
 * Manages the current organization context across the app.
 *
 * - Calls GET /api/orgs to get user organizations.
 * - Persists selected organization in localStorage.
 * - Exposes selectedOrg, orgs list, and setSelectedOrg.
 */

export interface Organization {
  id: string;
  githubOrgId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  type: string;
  role: string;
}

interface OrgContextValue {
  orgs: Organization[];
  selectedOrg: Organization | null;
  isLoading: boolean;
  setSelectedOrg: (org: Organization) => void;
  refetchOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used inside <OrgProvider>");
  }
  return ctx;
}

interface OrgProviderProps {
  children: ReactNode;
}

export function OrgProvider({ children }: OrgProviderProps) {
  const { isAuthenticated } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrgState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrgs = useCallback(async () => {
    if (!isAuthenticated) {
      setOrgs([]);
      setSelectedOrgState(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.get<{ data: Organization[] }>("/api/orgs");
      const list = res.data || [];
      setOrgs(list);

      const savedOrgId = localStorage.getItem("selectedOrgId");
      const matched = list.find((o) => o.id === savedOrgId);

      if (matched) {
        setSelectedOrgState(matched);
      } else if (list.length > 0) {
        setSelectedOrgState(list[0]);
        localStorage.setItem("selectedOrgId", list[0].id);
      } else {
        setSelectedOrgState(null);
      }
    } catch {
      setOrgs([]);
      setSelectedOrgState(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const setSelectedOrg = useCallback((org: Organization) => {
    setSelectedOrgState(org);
    localStorage.setItem("selectedOrgId", org.id);
  }, []);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgs,
      selectedOrg,
      isLoading,
      setSelectedOrg,
      refetchOrgs: fetchOrgs,
    }),
    [orgs, selectedOrg, isLoading, setSelectedOrg, fetchOrgs]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}
