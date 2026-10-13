import { useState, useEffect, useSyncExternalStore } from 'react';
import type {
  Household,
  CheckIn,
  Task,
  Volunteer,
  Report,
  AccessLogEntry,
  Settings,
} from '@rahatlink/core';
import { DEFAULT_SETTINGS } from '@rahatlink/core';
import {
  doc,
  householdsMap,
  checkInsArray,
  tasksMap,
  volunteersMap,
  reportsArray,
  accessLogArray,
  settingsMap,
  subscribeSyncState,
  getSyncState,
} from './yDoc';

// Hook 1: useSyncStatus
export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
}

// Hook 2: useHouseholds
export function useHouseholds(): Household[] {
  const [households, setHouseholds] = useState<Household[]>(() => {
    return Array.from(householdsMap.values());
  });

  useEffect(() => {
    const update = () => {
      setHouseholds(Array.from(householdsMap.values()));
    };
    update();
    householdsMap.observe(update);
    return () => {
      householdsMap.unobserve(update);
    };
  }, []);

  return households;
}

// Hook 3: useCheckIns
export function useCheckIns(): CheckIn[] {
  const [checkIns, setCheckIns] = useState<CheckIn[]>(() => {
    return checkInsArray.toArray();
  });

  useEffect(() => {
    const update = () => {
      setCheckIns(checkInsArray.toArray());
    };
    update();
    checkInsArray.observe(update);
    return () => {
      checkInsArray.unobserve(update);
    };
  }, []);

  return checkIns;
}

// Hook 4: useTasks
export function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() => {
    return Array.from(tasksMap.values());
  });

  useEffect(() => {
    const update = () => {
      setTasks(Array.from(tasksMap.values()));
    };
    update();
    tasksMap.observe(update);
    return () => {
      tasksMap.unobserve(update);
    };
  }, []);

  return tasks;
}

// Hook 5: useVolunteers
export function useVolunteers(): Volunteer[] {
  const [volunteers, setVolunteers] = useState<Volunteer[]>(() => {
    return Array.from(volunteersMap.values());
  });

  useEffect(() => {
    const update = () => {
      setVolunteers(Array.from(volunteersMap.values()));
    };
    update();
    volunteersMap.observe(update);
    return () => {
      volunteersMap.unobserve(update);
    };
  }, []);

  return volunteers;
}

// Hook 6: useReports
export function useReports(): Report[] {
  const [reports, setReports] = useState<Report[]>(() => {
    return reportsArray.toArray();
  });

  useEffect(() => {
    const update = () => {
      setReports(reportsArray.toArray());
    };
    update();
    reportsArray.observe(update);
    return () => {
      reportsArray.unobserve(update);
    };
  }, []);

  return reports;
}

// Hook 7: useSettings
export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(() => {
    const json = settingsMap.toJSON();
    return {
      disasterMode: json.disasterMode ?? DEFAULT_SETTINGS.disasterMode,
      disasterGraceFactor: json.disasterGraceFactor ?? DEFAULT_SETTINGS.disasterGraceFactor,
      weights: { ...DEFAULT_SETTINGS.weights, ...(json.weights || {}) },
    };
  });

  useEffect(() => {
    const update = () => {
      const json = settingsMap.toJSON();
      setSettings({
        disasterMode: json.disasterMode ?? DEFAULT_SETTINGS.disasterMode,
        disasterGraceFactor: json.disasterGraceFactor ?? DEFAULT_SETTINGS.disasterGraceFactor,
        weights: { ...DEFAULT_SETTINGS.weights, ...(json.weights || {}) },
      });
    };
    update();
    settingsMap.observe(update);
    return () => {
      settingsMap.unobserve(update);
    };
  }, []);

  return settings;
}

// ==========================================
// Mutation Helpers
// ==========================================

export function addCheckIn(checkIn: CheckIn) {
  doc.transact(() => {
    // 1. Append to check-ins array
    checkInsArray.push([checkIn]);

    // 2. Update the corresponding household's lastCheckInAt & status
    const household = householdsMap.get(checkIn.householdId);
    if (household) {
      householdsMap.set(checkIn.householdId, {
        ...household,
        lastCheckInAt: checkIn.at,
        lastBattery: checkIn.batteryPct ?? household.lastBattery,
        status: 'ok',
      });
    }
  });
}

export function upsertHousehold(household: Household) {
  householdsMap.set(household.id, household);
}

export function updateTask(task: Task) {
  tasksMap.set(task.id, task);
}

export function logAccess(entry: AccessLogEntry) {
  accessLogArray.push([entry]);
}

export function addReport(report: Report) {
  reportsArray.push([report]);
}

export function updateSettings(partial: Partial<Settings>) {
  doc.transact(() => {
    for (const [key, val] of Object.entries(partial)) {
      settingsMap.set(key, val);
    }
  });
}

/**
 * Plumbing stub for volunteer health briefing unlock (Prompt 2 & 8)
 */
export async function requestHealthBriefing(taskId: string, volunteerId: string) {
  const hubHost = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  try {
    const res = await fetch(`http://${hubHost}:4444/briefing/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, volunteerId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to unlock briefing');
    }
    return await res.json();
  } catch (err: any) {
    console.error('[RahatLink] Health briefing unlock error:', err);
    throw err;
  }
}

/**
 * Seed initial demo data if the store is empty
 */
export function seedDemoDataIfEmpty() {
  if (householdsMap.size === 0) {
    const demoHouseholds: Household[] = [
      {
        id: 'h-101',
        name: 'Sharma Residence (Elderly Couple)',
        lat: 26.8467,
        lng: 80.9462,
        address: 'House 12, Gomti Nagar, Lucknow',
        floor: 1,
        contactPhone: '+91 98765 43210',
        householdSize: 2,
        hasSmartphone: true,
        graceHours: 24,
        lastCheckInAt: new Date(Date.now() - 3600000).toISOString(),
        lastBattery: 82,
        consent: { health: true, grantedAt: new Date().toISOString() },
        status: 'ok',
      },
      {
        id: 'h-102',
        name: 'Gupta Household',
        lat: 26.8475,
        lng: 80.947,
        address: 'House 14, Gomti Nagar, Lucknow',
        floor: 2,
        contactPhone: '+91 98111 22334',
        householdSize: 1,
        hasSmartphone: false,
        graceHours: 12,
        lastCheckInAt: new Date(Date.now() - 7200000).toISOString(),
        proxyNeighbourId: 'h-101',
        consent: { health: false },
        status: 'ok',
      },
      {
        id: 'h-103',
        name: 'Verma Residence (Insulin Dependent)',
        lat: 26.8482,
        lng: 80.9455,
        address: 'House 19, Riverbank Colony, Lucknow',
        floor: 0,
        contactPhone: '+91 97222 33445',
        householdSize: 3,
        hasSmartphone: true,
        graceHours: 24,
        lastCheckInAt: new Date(Date.now() - 90000000).toISOString(), // >24h silent
        lastBattery: 45,
        consent: { health: true, grantedAt: new Date().toISOString() },
        status: 'grace',
      },
    ];

    doc.transact(() => {
      for (const h of demoHouseholds) {
        householdsMap.set(h.id, h);
      }
      if (settingsMap.size === 0) {
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
          settingsMap.set(k, v);
        }
      }
    });
  }
}
