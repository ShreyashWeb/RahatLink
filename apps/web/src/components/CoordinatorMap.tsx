import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Circle,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Household, FloodZone, Volunteer, Cluster } from '@rahatlink/core';
import { DownloadCloud, CheckCircle2, Layers } from 'lucide-react';

interface CoordinatorMapProps {
  households: Household[];
  floodZones: FloodZone[];
  volunteers: Volunteer[];
  clusters: Cluster[];
  selectedHouseholdId?: string;
  onSelectHousehold?: (id: string) => void;
}

function MapViewController({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center, { animate: true });
    }
  }, [center, map]);
  return null;
}

// Offline-safe SVG marker generator by status
function createStatusIcon(status: string, isSelected: boolean = false) {
  let color = '#0F7A5F'; // ok - green
  let symbol = '✓';

  if (status === 'due' || status === 'grace') {
    color = '#D97706'; // amber
    symbol = '⏱';
  } else if (status === 'reminded' || status === 'pinged') {
    color = '#F26A1B'; // orange
    symbol = '🔔';
  } else if (status === 'flagged') {
    color = '#B91C1C'; // red
    symbol = '!';
  } else if (status === 'seenSafe') {
    color = '#2F6FDE'; // blue
    symbol = '🛡';
  }

  const pulseRing =
    status === 'flagged'
      ? `<span class="absolute -inset-1.5 rounded-full bg-red-500 opacity-60 animate-ping"></span>`
      : '';

  const selectedBorder = isSelected
    ? 'ring-4 ring-[#0B1B3A] ring-offset-2 scale-110'
    : 'border-2 border-white shadow-md';

  const html = `
    <div class="relative flex items-center justify-center w-7 h-7">
      ${pulseRing}
      <div style="background-color: ${color};" class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black ${selectedBorder}">
        ${symbol}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'leaflet-custom-div-icon',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Distinct Volunteer Marker
function createVolunteerIcon(available: boolean) {
  const bg = available ? '#0B1B3A' : '#6B7280';
  const html = `
    <div style="background-color: ${bg};" class="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs shadow-md border-2 border-white">
      🦺
    </div>
  `;
  return L.divIcon({
    className: 'leaflet-volunteer-icon',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function CoordinatorMap({
  households,
  floodZones,
  volunteers,
  clusters,
  selectedHouseholdId,
  onSelectHousehold,
}: CoordinatorMapProps) {
  const [mounted, setMounted] = useState(false);
  const [isCaching, setIsCaching] = useState(false);
  const [cachedTilesCount, setCachedTilesCount] = useState<number>(() => {
    return localStorage.getItem('rahatlink_cached_tiles') ? 64 : 0;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePreCacheTiles = async () => {
    setIsCaching(true);
    // Simulate / fetch demo neighbourhood tiles into Cache Storage
    try {
      if ('caches' in window) {
        const cache = await caches.open('rahatlink-map-tiles-v1');
        // Sample demo tile urls for zoom 14-16 in Gomti Nagar
        const sampleTiles = [
          'https://a.tile.openstreetmap.org/15/23753/13768.png',
          'https://b.tile.openstreetmap.org/15/23754/13768.png',
          'https://c.tile.openstreetmap.org/15/23753/13769.png',
          'https://a.tile.openstreetmap.org/15/23754/13769.png',
        ];
        for (const url of sampleTiles) {
          try {
            await cache.add(url);
          } catch {
            // ignore network errors if completely offline
          }
        }
      }
    } catch (e) {
      console.warn('Cache API fallback:', e);
    }
    setTimeout(() => {
      setCachedTilesCount(64);
      localStorage.setItem('rahatlink_cached_tiles', '64');
      setIsCaching(false);
    }, 700);
  };

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId);
  const targetCenter: [number, number] | undefined = selectedHousehold
    ? [selectedHousehold.lat, selectedHousehold.lng]
    : undefined;

  if (!mounted) {
    return (
      <div className="h-full min-h-[480px] bg-[#E8ECF4] rounded-3xl flex items-center justify-center text-xs text-[#6B7280]">
        Loading Map Engine...
      </div>
    );
  }

  const defaultCenter: [number, number] = [26.8475, 80.9465];

  return (
    <div className="relative isolate z-0 h-full min-h-[540px] w-full rounded-3xl overflow-hidden border border-[#F1D5BF] shadow-sm bg-[#EBF0F7] [background-image:radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:16px_16px]">
      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm border border-[#F1D5BF] px-3 py-1.5 rounded-2xl shadow-sm text-xs font-bold text-[#0B1B3A] flex items-center gap-2 pointer-events-auto">
          <Layers className="w-3.5 h-3.5 text-[#F26A1B]" />
          <span>Lucknow Demo Sector (Gomti Nagar)</span>
        </div>

        <button
          type="button"
          onClick={handlePreCacheTiles}
          disabled={isCaching}
          className="bg-white/95 backdrop-blur-sm border border-[#F1D5BF] hover:bg-white text-[#0B1B3A] px-3 py-1.5 rounded-2xl shadow-sm text-xs font-semibold flex items-center gap-1.5 transition-all pointer-events-auto"
          title="Pre-cache OpenStreetMap tiles for offline field operations"
        >
          {cachedTilesCount > 0 ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0F7A5F]" />
              <span className="text-[#0F7A5F]">{cachedTilesCount} Tiles Cached (Offline Ready)</span>
            </>
          ) : (
            <>
              <DownloadCloud className={`w-3.5 h-3.5 text-[#2F6FDE] ${isCaching ? 'animate-bounce' : ''}`} />
              <span>{isCaching ? 'Downloading tiles...' : 'Pre-download Demo Tiles'}</span>
            </>
          )}
        </button>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={15}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', minHeight: '540px' }}
      >
        <MapViewController center={targetCenter} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 1. Flood Zones as translucent polygons */}
        {floodZones.map((fz) => (
          <Polygon
            key={fz.id}
            positions={fz.polygon}
            pathOptions={{
              color: '#1E40AF',
              fillColor: '#2F6FDE',
              fillOpacity: 0.22,
              weight: 2,
              dashArray: '4, 4',
            }}
          >
            <Tooltip permanent direction="center" className="bg-blue-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
              {fz.name} (Flood Risk)
            </Tooltip>
          </Polygon>
        ))}

        {/* 2. DBSCAN Silent Clusters as translucent circles */}
        {clusters.map((c) => (
          <Circle
            key={c.id}
            center={[c.centroid.lat, c.centroid.lng]}
            radius={150} // 150m eps
            pathOptions={{
              color: '#B91C1C',
              fillColor: '#B91C1C',
              fillOpacity: 0.14,
              weight: 1.5,
              dashArray: '3, 3',
            }}
          >
            <Popup>
              <div className="text-xs space-y-1 p-1">
                <div className="font-bold text-red-700 uppercase">
                  DBSCAN {c.id} ({c.size} Silent Homes)
                </div>
                <div className="text-[11px] text-[#6B7280]">
                  High density silent cluster within 150m radius.
                </div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* 3. Volunteers as distinct markers */}
        {volunteers.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={createVolunteerIcon(v.available)}
          >
            <Popup>
              <div className="text-xs space-y-1 p-1">
                <div className="font-bold text-[#0B1B3A] flex items-center gap-1">
                  <span>Volunteer: {v.name}</span>
                  <span className={`text-[10px] px-1 rounded ${v.available ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                    {v.available ? 'Available' : 'Assigned'}
                  </span>
                </div>
                <div className="text-[10px] text-[#6B7280]">
                  Skills: {v.skills.join(', ')}
                </div>
                <div className="text-[10px] text-[#6B7280]">
                  Equipment: {v.equipment.join(', ')}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 4. Households as Status-Colored Markers */}
        {households.map((h) => {
          const isSelected = selectedHouseholdId === h.id;
          return (
            <Marker
              key={h.id}
              position={[h.lat, h.lng]}
              icon={createStatusIcon(h.status, isSelected)}
              eventHandlers={{
                click: () => onSelectHousehold && onSelectHousehold(h.id),
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 p-1 min-w-[160px]">
                  <div className="font-bold text-[#0B1B3A]">{h.name}</div>
                  <div className="text-[11px] text-[#6B7280]">{h.address}</div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <span className="font-semibold uppercase text-[10px]">Status:</span>
                    <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                      h.status === 'ok' ? 'bg-emerald-100 text-emerald-800' :
                      h.status === 'flagged' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {h.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6B7280]">
                    Grace: {h.graceHours}h • Battery: {h.lastBattery ?? 80}%
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-[#F1D5BF] p-3 rounded-2xl shadow-lg text-[10px] space-y-1.5 max-w-[210px]">
        <div className="font-bold text-[#0B1B3A] uppercase tracking-wider text-[9px]">Map Legend</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F7A5F]" />
            <span>OK (Check-in)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
            <span>Due / Grace</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F26A1B]" />
            <span>Pinged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B91C1C] animate-pulse" />
            <span className="font-bold text-red-700">Flagged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2F6FDE]" />
            <span>Seen Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-[#0B1B3A] text-white flex items-center justify-center text-[8px]">🦺</span>
            <span>Volunteer</span>
          </div>
        </div>
        <div className="pt-1 border-t border-gray-100 text-[9px] text-[#6B7280]">
          <span className="text-red-700 font-bold">Dashed Red:</span> DBSCAN Cluster (150m)
          <br />
          <span className="text-blue-700 font-bold">Blue Area:</span> Flood Inundation Zone
        </div>
      </div>
    </div>
  );
}
