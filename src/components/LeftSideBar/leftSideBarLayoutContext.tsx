import { createContext, useContext } from 'react';

export type LeftSideBarLayoutContextValue = {
  chatsChromeCollapsed: boolean;
};

export const LeftSideBarLayoutContext =
  createContext<LeftSideBarLayoutContextValue | null>(null);

export function useLeftSideBarLayout(): LeftSideBarLayoutContextValue | null {
  return useContext(LeftSideBarLayoutContext);
}
