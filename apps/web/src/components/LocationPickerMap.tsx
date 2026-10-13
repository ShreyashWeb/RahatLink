import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default icon path in bundlers
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

function MapClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    },
  });
  return null;
}

export function LocationPickerMap({ lat, lng, onChange }: LocationPickerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-48 bg-[#E8ECF4] rounded-xl flex items-center justify-center text-xs text-[#6B7280]">Loading map...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="h-48 w-full rounded-xl overflow-hidden border border-[#F1D5BF] shadow-inner relative z-0">
        <MapContainer
          center={[lat, lng]}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lng]} icon={customIcon} />
          <MapClickHandler onChange={onChange} />
        </MapContainer>
      </div>

      <div className="flex gap-2 text-xs">
        <div className="flex-1 bg-[#FFF6EE] p-1.5 rounded-lg border border-[#F1D5BF]">
          <span className="text-[#6B7280]">Lat:</span> <span className="font-semibold text-[#0B1B3A]">{lat}</span>
        </div>
        <div className="flex-1 bg-[#FFF6EE] p-1.5 rounded-lg border border-[#F1D5BF]">
          <span className="text-[#6B7280]">Lng:</span> <span className="font-semibold text-[#0B1B3A]">{lng}</span>
        </div>
      </div>
    </div>
  );
}
