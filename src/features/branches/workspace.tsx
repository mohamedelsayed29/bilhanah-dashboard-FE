import { createContext, useContext } from 'react';
import type { BranchList, OwnerBranch } from '@bilhanah/contracts';
import { useBranchesQuery } from '../restaurant/queries';

/**
 * Who is running the dashboard and where their pages live. Owners and branch managers share
 * the orders board, tables, floor, branch menu, branch settings and insights; managers see
 * them under /manager, for their branch.
 */
export type Workspace = {
  role: 'OWNER' | 'MANAGER';
  restaurant: { name: string; subdomain: string; logoUrl: string | null; brandColor: string | null };
  /** The owner-area path of a shared page, as this viewer's path (e.g. /orders → /manager). */
  to: (path: string) => string;
  /** Where this viewer changes a branch's hours and ordering. */
  branchSettings: (branchId: string) => string;
};

const WorkspaceContext = createContext<Workspace | null>(null);
export const WorkspaceProvider = WorkspaceContext.Provider;

/** Owner paths of the pages managers also have, and theirs. */
export function managerPath(path: string): string {
  const [pathname, search = ''] = path.split('?');
  const mapped = pathname === '/orders' ? '/manager'
    : pathname === '/branches/menu' ? '/manager/menu'
      : pathname!.startsWith('/branches/') ? '/manager/settings'
        : `/manager${pathname}`;
  return search ? `${mapped}?${search}` : mapped;
}

export function ownerWorkspace(restaurant: Workspace['restaurant']): Workspace {
  return { role: 'OWNER', restaurant, to: path => path, branchSettings: branchId => `/branches/${branchId}` };
}

export function managerWorkspace(restaurant: Workspace['restaurant']): Workspace {
  return { role: 'MANAGER', restaurant, to: managerPath, branchSettings: () => '/manager/settings' };
}

export function useWorkspace(): Workspace {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context;
}

/** The branch list inside a shell that loaded it (owner and manager shells). */
export function useBranchList(): BranchList {
  const { data } = useBranchesQuery();
  if (!data) throw new Error('useBranchList() is only available inside a shell that loads the branches.');
  return data;
}

export function useOwnerBranch(branchId: string | null): OwnerBranch | null {
  const list = useBranchList();
  return branchId ? list.branches.find(branch => branch.id === branchId) ?? null : null;
}
