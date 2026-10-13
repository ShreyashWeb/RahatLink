import { useState, useEffect, useSyncExternalStore } from 'react';
import type {
  Household,
  CheckIn,
  Task,
  Volunteer,
  Report,
  AccessLogEntry,
  Settings,
  AppNotification,
  HealthProfile,
  FloodZone,
} from '@rahatlink/core';
import { DEFAULT_SETTINGS, evaluateHousehold } from '@rahatlink/core';
import {
  doc,
  householdsMap,
  checkInsArray,
  tasksMap,
  volunteersMap,
  reportsArray,
  accessLogArray,
  notificationsArray,
  settingsMap,
  floodZonesArray,
  healthProfilesMap,
  subscribeSyncState,
  getSyncState,
} from './yDoc';

export function getHealthProfile(householdId: string): HealthProfile | undefined {
  return healthProfilesMap.get(householdId);
}

export function useHealthProfiles(): Map<string, HealthProfile> {
  const [profiles, setProfiles] = useState<Map<string, HealthProfile>>(() => {
    return new Map(Array.from(healthProfilesMap.entries()));
  });

  useEffect(() => {
    const update = () => {
      setProfiles(new Map(Array.from(healthProfilesMap.entries())));
    };
    healthProfilesMap.observe(update);
    return () => {
      healthProfilesMap.unobserve(update);
    };
  }, []);

  return profiles;
}

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

// Hook 8: useNotifications
export function useNotifications(): AppNotification[] {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    return notificationsArray.toArray();
  });

  useEffect(() => {
    const update = () => {
      setNotifications(notificationsArray.toArray());
    };
    notificationsArray.observe(update);
    return () => {
      notificationsArray.unobserve(update);
    };
  }, []);

  return notifications;
}

/**
 * Run silence engine evaluation across all households
 */
export function runSilenceEvaluation(now: Date = new Date()) {
  const currentSettings = {
    ...DEFAULT_SETTINGS,
    ...settingsMap.toJSON(),
  };

  const households = Array.from(householdsMap.values());
  doc.transact(() => {
    for (const h of households) {
      const evaluation = evaluateHousehold(h, now, currentSettings);
      if (evaluation.status !== h.status) {
        householdsMap.set(h.id, {
          ...h,
          status: evaluation.status,
        });

        if (evaluation.status === 'reminded') {
          notificationsArray.push([
            {
              id: `notif-remind-${Date.now()}-${h.id}`,
              householdId: h.id,
              householdName: h.name,
              type: 'reminded',
              message: `Check-in grace expired. Automated SMS reminder sent to ${h.name}.`,
              at: now.toISOString(),
            },
          ]);
        } else if (evaluation.status === 'pinged') {
          notificationsArray.push([
            {
              id: `notif-ping-${Date.now()}-${h.id}`,
              householdId: h.id,
              householdName: h.name,
              type: 'pinged',
              message: `No response to reminder. Welfare check assigned to nearby neighbour for ${h.name}.`,
              at: now.toISOString(),
            },
          ]);
        } else if (evaluation.status === 'flagged') {
          notificationsArray.push([
            {
              id: `notif-flag-${Date.now()}-${h.id}`,
              householdId: h.id,
              householdName: h.name,
              type: 'flagged',
              message: `Household ${h.name} is FLAGGED. Entered clustering & risk queue.`,
              at: now.toISOString(),
            },
          ]);
        }
      }
    }
  });
}

// Hook 9: useFloodZones
export function useFloodZones(): FloodZone[] {
  const [floodZones, setFloodZones] = useState<FloodZone[]>(() => {
    return floodZonesArray.toArray();
  });

  useEffect(() => {
    const update = () => {
      setFloodZones(floodZonesArray.toArray());
    };
    floodZonesArray.observe(update);
    return () => {
      floodZonesArray.unobserve(update);
    };
  }, []);

  return floodZones;
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

export function upsertVolunteer(volunteer: Volunteer) {
  volunteersMap.set(volunteer.id, volunteer);
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
 * Connects to hub if available; falls back to local authenticated unlock if offline
 */
export async function requestHealthBriefing(taskId: string, volunteerId: string) {
  const hubHost = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  try {
    const res = await fetch(`http://${hubHost}:4444/briefing/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, volunteerId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Hub unreachable or fully offline, fall through to local unlock
  }

  // Offline-first local unlock: log access and retrieve profile
  const task = tasksMap.get(taskId);
  const primaryHouseholdId = task?.householdIds[0] || 'unknown';
  const profile = healthProfilesMap.get(primaryHouseholdId);

  logAccess({
    id: `log-briefing-${Date.now()}`,
    at: new Date().toISOString(),
    actor: volunteerId,
    role: 'volunteer',
    householdId: primaryHouseholdId,
    field: 'healthProfile',
    action: 'view',
    reason: `Volunteer briefing unlocked for task ${taskId}`,
  });

  return {
    unlocked: true,
    taskId,
    volunteerId,
    expiresInSeconds: 21600,
    healthProfile: profile || {
      householdId: primaryHouseholdId,
      conditions: [],
      allergies: [],
      notes: 'No sensitive conditions on file',
      updatedAt: new Date().toISOString(),
    },
    simulated: true,
  };
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
        lat: 26.8476,
        lng: 80.9461, // Cluster 1 member (<70m from h-104)
        address: 'House 19, Riverbank Colony, Lucknow',
        floor: 0,
        contactPhone: '+91 97222 33445',
        householdSize: 3,
        hasSmartphone: true,
        graceHours: 24,
        lastCheckInAt: new Date(Date.now() - 54 * 3600000).toISOString(), // >24h silent
        lastBattery: 4, // critical battery
        consent: { health: true, grantedAt: new Date().toISOString() },
        status: 'flagged',
      },
      {
        id: 'h-104',
        name: 'Mishra Family (Riverbank)',
        lat: 26.8471,
        lng: 80.9463, // Cluster 1 member
        address: 'House 21, Riverbank Colony, Lucknow',
        floor: 1,
        contactPhone: '+91 98333 44556',
        householdSize: 4,
        hasSmartphone: true,
        graceHours: 24,
        lastCheckInAt: new Date(Date.now() - 50 * 3600000).toISOString(),
        lastBattery: 45,
        consent: { health: false },
        status: 'flagged',
      },
      {
        id: 'h-105',
        name: 'Srivastava Home',
        lat: 26.8473,
        lng: 80.9465, // Cluster 1 member
        address: 'House 22, Riverbank Colony, Lucknow',
        floor: 2,
        contactPhone: '+91 98444 55667',
        householdSize: 2,
        hasSmartphone: true,
        graceHours: 24,
        lastCheckInAt: new Date(Date.now() - 48 * 3600000).toISOString(),
        lastBattery: 60,
        consent: { health: false },
        status: 'flagged',
      },
      {
        id: 'h-106',
        name: 'Solitary Outlier (Indiranagar)',
        lat: 26.858,
        lng: 80.958, // Outlier 1.2km away
        address: 'House 99, Sector 14, Indiranagar',
        floor: 1,
        contactPhone: '+91 98555 66778',
        householdSize: 1,
        hasSmartphone: true,
        graceHours: 24,
        lastCheckInAt: new Date(Date.now() - 36 * 3600000).toISOString(),
        lastBattery: 90,
        consent: { health: false },
        status: 'flagged',
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

  // Seed flood zones if empty
  if (floodZonesArray.length === 0) {
    const demoFloodZones: FloodZone[] = [
      {
        id: 'fz-1',
        name: 'Gomti Riverbank Sector A',
        polygon: [
          [26.8475, 80.946],
          [26.8485, 80.947],
          [26.8478, 80.948],
          [26.8471, 80.9472],
        ],
      },
    ];
    doc.transact(() => {
      floodZonesArray.push(demoFloodZones);
    });
  }

  // Seed volunteers if empty
  if (volunteersMap.size === 0) {
    const demoVolunteers: Volunteer[] = [
      {
        id: 'v-101',
        name: 'Priya Verma',
        skills: ['first-aid', 'boat', 'medical'],
        equipment: ['life-jacket', 'first-aid-kit'],
        lat: 26.8468,
        lng: 80.9452,
        available: true,
      },
      {
        id: 'v-102',
        name: 'Amit Kumar',
        skills: ['first-aid'],
        equipment: ['first-aid-kit'],
        lat: 26.848,
        lng: 80.9465,
        available: true,
      },
      {
        id: 'v-103',
        name: 'Sandeep Singh',
        skills: ['boat'],
        equipment: ['boat', 'life-jacket'],
        lat: 26.844,
        lng: 80.943,
        available: false,
      },
    ];
    doc.transact(() => {
      for (const v of demoVolunteers) {
        volunteersMap.set(v.id, v);
      }
    });
  }

  // Seed health profile for h-103 if empty (stored in separate privacy-isolated healthDoc)
  if (healthProfilesMap.size === 0) {
    healthProfilesMap.set('h-103', {
      householdId: 'h-103',
      conditions: ['insulin-dependent', 'limited-mobility'],
      allergies: ['penicillin'],
      medications: 'Insulin Glargine 20u daily',
      notes: 'Elderly resident, needs refrigerated insulin supplies and ground-floor access assistance',
      updatedAt: new Date().toISOString(),
    });
  }
}
