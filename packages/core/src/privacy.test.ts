import { describe, it, expect } from 'vitest';
import { canView, isBriefingTokenValid } from './privacy';

describe('Privacy Model & Access Matrix (packages/core/src/privacy.ts)', () => {
  describe('Resident Role', () => {
    it('allows resident to view all fields of their own record', () => {
      expect(canView('resident', 'fullMedicalBriefing', undefined, { isOwnRecord: true })).toBe(true);
      expect(canView('resident', 'exactAddress', undefined, { isOwnRecord: true })).toBe(true);
      expect(canView('resident', 'contactPhone', undefined, { isOwnRecord: true })).toBe(true);
      expect(canView('resident', 'conditionsSummary', undefined, { isOwnRecord: true })).toBe(true);
    });

    it('denies resident access to other households data', () => {
      expect(canView('resident', 'fullMedicalBriefing', undefined, { isOwnRecord: false })).toBe(false);
      expect(canView('resident', 'exactAddress', undefined, { isOwnRecord: false })).toBe(false);
    });
  });

  describe('Coordinator Role', () => {
    it('always permits coordinator to see risk level, key needs, and conditions summary', () => {
      expect(canView('coordinator', 'riskLevel', 'resolved')).toBe(true);
      expect(canView('coordinator', 'keyNeeds', 'cancelled')).toBe(true);
      expect(canView('coordinator', 'conditionsSummary', 'resolved')).toBe(true);
    });

    it('permits coordinator to see exact address/floor/contact only while incident is open', () => {
      // Open / active states
      expect(canView('coordinator', 'exactAddress', 'suggested')).toBe(true);
      expect(canView('coordinator', 'exactAddress', 'approved')).toBe(true);
      expect(canView('coordinator', 'floor', 'accepted')).toBe(true);
      expect(canView('coordinator', 'contactPhone', 'overridden')).toBe(true);

      // Closed / resolved states
      expect(canView('coordinator', 'exactAddress', 'resolved')).toBe(false);
      expect(canView('coordinator', 'floor', 'resolved')).toBe(false);
      expect(canView('coordinator', 'contactPhone', 'cancelled')).toBe(false);
    });

    it('withholds raw full medical dossier from standard coordinator view', () => {
      expect(canView('coordinator', 'fullMedicalBriefing', 'approved')).toBe(false);
    });
  });

  describe('Volunteer Role (Before and After Acceptance)', () => {
    it('strictly limits volunteer before acceptance to non-sensitive fields', () => {
      // Allowed before accept
      expect(canView('volunteer', 'riskLevel', 'approved')).toBe(true);
      expect(canView('volunteer', 'distance', 'approved')).toBe(true);
      expect(canView('volunteer', 'roughLocation', 'approved')).toBe(true);
      expect(canView('volunteer', 'keyNeeds', 'approved')).toBe(true);

      // Blocked before accept
      expect(canView('volunteer', 'exactAddress', 'approved')).toBe(false);
      expect(canView('volunteer', 'floor', 'approved')).toBe(false);
      expect(canView('volunteer', 'contactPhone', 'approved')).toBe(false);
      expect(canView('volunteer', 'conditionsSummary', 'approved')).toBe(false);
      expect(canView('volunteer', 'fullMedicalBriefing', 'approved')).toBe(false);
    });

    it('unlocks full briefing to volunteer after task is accepted', () => {
      expect(canView('volunteer', 'exactAddress', 'accepted')).toBe(true);
      expect(canView('volunteer', 'floor', 'accepted')).toBe(true);
      expect(canView('volunteer', 'contactPhone', 'accepted')).toBe(true);
      expect(canView('volunteer', 'fullMedicalBriefing', 'accepted', { hasHealthConsent: true })).toBe(true);
    });

    it('suppresses medical briefing after acceptance if resident withheld health consent', () => {
      expect(canView('volunteer', 'exactAddress', 'accepted', { hasHealthConsent: false })).toBe(true);
      expect(canView('volunteer', 'fullMedicalBriefing', 'accepted', { hasHealthConsent: false })).toBe(false);
    });

    it('revokes volunteer briefing access once task is resolved or cancelled', () => {
      expect(canView('volunteer', 'exactAddress', 'resolved')).toBe(false);
      expect(canView('volunteer', 'floor', 'resolved')).toBe(false);
      expect(canView('volunteer', 'contactPhone', 'resolved')).toBe(false);
      expect(canView('volunteer', 'fullMedicalBriefing', 'resolved')).toBe(false);
    });
  });

  describe('Break-Glass Emergency Protocol', () => {
    it('releases medical briefing under break-glass if resident granted health consent', () => {
      expect(
        canView('coordinator', 'fullMedicalBriefing', 'approved', {
          isBreakGlass: true,
          hasHealthConsent: true,
        }),
      ).toBe(true);
    });

    it('suppresses medical briefing under break-glass if consent was NOT given, releasing location only', () => {
      // Medical dossier withheld
      expect(
        canView('coordinator', 'fullMedicalBriefing', 'approved', {
          isBreakGlass: true,
          hasHealthConsent: false,
        }),
      ).toBe(false);

      // Non-medical location/contact released for physical life rescue
      expect(
        canView('coordinator', 'exactAddress', 'approved', {
          isBreakGlass: true,
          hasHealthConsent: false,
        }),
      ).toBe(true);
      expect(
        canView('coordinator', 'floor', 'approved', {
          isBreakGlass: true,
          hasHealthConsent: false,
        }),
      ).toBe(true);
    });
  });

  describe('Token Expiration Verification (isBriefingTokenValid)', () => {
    const unlockTime = new Date('2026-10-13T12:00:00Z');

    it('returns true when token is within max 6h duration and task is active', () => {
      const now2hLater = new Date('2026-10-13T14:00:00Z');
      expect(isBriefingTokenValid(unlockTime, 'accepted', 6, now2hLater)).toBe(true);
    });

    it('rejects token when task has been resolved', () => {
      const now1hLater = new Date('2026-10-13T13:00:00Z');
      expect(isBriefingTokenValid(unlockTime, 'resolved', 6, now1hLater)).toBe(false);
    });

    it('rejects token when task has been cancelled', () => {
      const now1hLater = new Date('2026-10-13T13:00:00Z');
      expect(isBriefingTokenValid(unlockTime, 'cancelled', 6, now1hLater)).toBe(false);
    });

    it('rejects token when elapsed time exceeds 6 hours', () => {
      const now7hLater = new Date('2026-10-13T19:01:00Z');
      expect(isBriefingTokenValid(unlockTime, 'accepted', 6, now7hLater)).toBe(false);
    });
  });
});
