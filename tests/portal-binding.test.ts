import { describe, expect, it } from 'vitest';
import type { EditorTab, Portal } from '../src/shared/types';
import { getPortalBindingStatus } from '../src/editor/utils/portal-binding';

const baseTab: EditorTab = {
  id: 'tab-1',
  displayName: 'Module/collection.groovy',
  content: 'print("hi")',
  language: 'groovy',
  mode: 'collection',
  source: {
    type: 'module',
    moduleId: 1,
    moduleType: 'datasource',
    portalId: 'portal-a',
    portalHostname: 'a.logicmonitor.com',
  },
};

const portals: Portal[] = [
  {
    id: 'portal-a',
    hostname: 'a.logicmonitor.com',
    displayName: 'Portal A',
    csrfToken: null,
    csrfTokenTimestamp: null,
    tabIds: [],
    status: 'active',
  },
  {
    id: 'portal-b',
    hostname: 'b.logicmonitor.com',
    displayName: 'Portal B',
    csrfToken: null,
    csrfTokenTimestamp: null,
    tabIds: [],
    status: 'active',
  },
];

describe('getPortalBindingStatus', () => {
  it('returns unbound when tab lacks portal binding', () => {
    const tab = { ...baseTab, source: { ...baseTab.source, portalId: undefined } };
    const status = getPortalBindingStatus(tab, 'portal-a', portals);
    expect(status.isBound).toBe(false);
    expect(status.isActive).toBe(false);
  });

  it('returns inactive when portal is not connected', () => {
    const status = getPortalBindingStatus(baseTab, 'portal-a', portals.filter(p => p.id !== 'portal-a'));
    expect(status.isBound).toBe(true);
    expect(status.isActive).toBe(false);
  });

  it('returns inactive when active portal does not match binding', () => {
    const status = getPortalBindingStatus(baseTab, 'portal-b', portals);
    expect(status.isBound).toBe(true);
    expect(status.isActive).toBe(false);
  });

  it('returns inactive when bound portal is not active', () => {
    const status = getPortalBindingStatus(
      baseTab,
      'portal-a',
      [{ ...portals[0], status: 'expired' }]
    );
    expect(status.isActive).toBe(false);
  });

  it('returns active when bound portal is selected and active', () => {
    const status = getPortalBindingStatus(baseTab, 'portal-a', portals);
    expect(status.isBound).toBe(true);
    expect(status.isActive).toBe(true);
    expect(status.portalId).toBe('portal-a');
  });
});
