import { api } from './apiClient';

export interface ActiveOrg {
  id: string;
  login: string;
  name: string | null;
}

// saved org may be gone, fall back to the first. shared so every tab shows the same org
export async function resolveActiveOrg(activeOrgId: string | null): Promise<ActiveOrg | null> {
  const orgs = await api.get<{ data: ActiveOrg[] }>('/api/orgs');
  return orgs.data.find((o) => o.id === activeOrgId) ?? orgs.data[0] ?? null;
}
