import type {
  HealthSnapshot,
  Organization,
  PullRequest,
  QualityGate,
  Repository,
  User,
} from '@codehealth/db';

import { enqueueBulkLink } from '../../src/services/bulkLinkService';
import {
  addOrgMember,
  addRepoMember,
  createFinding,
  createOrg,
  createPullRequest,
  createQualityGate,
  createRepo,
  createSnapshot,
  createUser,
} from './factories';

export interface Tenant {
  org: Organization;
  /** org OWNER, and owner of `repo` */
  owner: User;
  /** org ADMIN, no repo membership — passes requireRepoAccess by org role */
  admin: User;
  /** org MEMBER + repo TEAM_LEAD */
  teamLead: User;
  /** org MEMBER + repo DEVELOPER */
  developer: User;
  /** org MEMBER with no repo membership — 403 on repo routes */
  bystander: User;
  repo: Repository;
  snapshot: HealthSnapshot;
  pullRequest: PullRequest;
  qualityGate: QualityGate;
  /** a queued bulk-link job owned by this org (lives in Redis, not Postgres) */
  bulkLinkJobId: string;
}

export async function seedTenant(label: string): Promise<Tenant> {
  const org = await createOrg({ login: `${label}-org`, name: `${label} org` });

  const owner = await createUser({ username: `${label}_owner` });
  const admin = await createUser({ username: `${label}_admin` });
  const teamLead = await createUser({ username: `${label}_lead` });
  const developer = await createUser({ username: `${label}_dev` });
  const bystander = await createUser({ username: `${label}_bystander` });

  await addOrgMember(org, owner, 'OWNER');
  await addOrgMember(org, admin, 'ADMIN');
  await addOrgMember(org, teamLead, 'MEMBER');
  await addOrgMember(org, developer, 'MEMBER');
  await addOrgMember(org, bystander, 'MEMBER');

  const repo = await createRepo(org, owner, { name: `${label}-repo` });
  await addRepoMember(repo, teamLead, 'TEAM_LEAD', 'ACTIVE', owner);
  await addRepoMember(repo, developer, 'DEVELOPER', 'ACTIVE', owner);

  const snapshot = await createSnapshot(repo);
  await createFinding(snapshot, { file: `src/${label}-secret.ts`, message: `${label} finding` });
  const pullRequest = await createPullRequest(repo, { title: `${label} pull request` });
  const qualityGate = await createQualityGate(repo);

  // no worker runs in tests, so the job just sits in the queue
  const { jobId } = await enqueueBulkLink(owner.id, org.id, [900_001, 900_002]);

  return {
    org,
    owner,
    admin,
    teamLead,
    developer,
    bystander,
    repo,
    snapshot,
    pullRequest,
    qualityGate,
    bulkLinkJobId: jobId!,
  };
}

export interface TwoOrgs {
  a: Tenant;
  b: Tenant;
  /** a signed-in user who belongs to no organization at all */
  outsider: User;
}

// two separate orgs plus a user in neither
export async function seedTwoOrgs(): Promise<TwoOrgs> {
  const a = await seedTenant('acme');
  const b = await seedTenant('globex');
  const outsider = await createUser({ username: 'outsider' });
  return { a, b, outsider };
}
