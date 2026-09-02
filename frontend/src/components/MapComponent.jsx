import React, { useEffect, useRef, useState } from 'react';
import { Search, Navigation } from 'lucide-react';

export default function MapComponent({ 
  mode = 'pick', // 'pick' or 'view'
  value = { lat: 28.6139, lng: 77.2295 }, // default Delhi
  onChange = null, 
  incidents = [], 
  onIncidentSelect = null,
  activeIncidentId = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const incidentMarkersRef = useRef({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if Leaflet (L) is loaded from CDN
    if (!window.L) {
      console.error('Leaflet L global object is not available.');
      return;
    }

    const L = window.L;

    // Initialize map centered at value or Delhi
    const center = mode === 'pick' ? [value.lat, value.lng] : [28.6139, 77.2295];
    const initialZoom = mode === 'pick' ? 14 : 11;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: initialZoom,
      zoomControl: true
    });

    mapInstanceRef.current = map;

    // Add standard OpenStreetMap tiles (darkened automatically by CSS filter on .leaflet-tile)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Mode-specific configuration
    if (mode === 'pick') {
      // Create picker marker
      const marker = L.marker([value.lat, value.lng], {
        draggable: true
      }).addTo(map);
      markerInstanceRef.current = marker;

      // Listen for drag end
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        if (onChange) {
          onChange({ lat: position.lat, lng: position.lng });
        }
      });

      // Listen for map clicks to position marker
      map.on('click', (e) => {
        const position = e.latlng;
        marker.setLatLng(position);
        if (onChange) {
          onChange({ lat: position.lat, lng: position.lng });
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mode]);

  // Handle value change for picker marker
  useEffect(() => {
    if (mode === 'pick' && mapInstanceRef.current && markerInstanceRef.current) {
      const currentPos = markerInstanceRef.current.getLatLng();
      if (currentPos.lat !== value.lat || currentPos.lng !== value.lng) {
        markerInstanceRef.current.setLatLng([value.lat, value.lng]);
        mapInstanceRef.current.setView([value.lat, value.lng], mapInstanceRef.current.getZoom());
      }
    }
  }, [value, mode]);

  // Handle active incident focus
  useEffect(() => {
    if (mode === 'view' && mapInstanceRef.current && activeIncidentId) {
      const marker = incidentMarkersRef.current[activeIncidentId];
      if (marker) {
        const position = marker.getLatLng();
        mapInstanceRef.current.setView(position, 14);
        marker.openPopup();
      }
    }
  }, [activeIncidentId, mode]);

  // Populate markers in View Mode
  useEffect(() => {
    if (mode !== 'view' || !mapInstanceRef.current) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear existing incident markers
    Object.values(incidentMarkersRef.current).forEach(m => m.remove());
    incidentMarkersRef.current = {};

    incidents.forEach(inc => {
      // Determine severity color code
      let color = '#00E676'; // Low (Green)
      if (inc.severity === 'Medium') color = '#FFD200'; // Yellow
      else if (inc.severity === 'High') color = '#FF5E3A'; // Orange
      else if (inc.severity === 'Critical') color = '#FF0055'; // Pink/Red

      // Determine size based on priority score (larger circle = higher priority)
      const radius = 8 + (inc.priority_score / 15);

      // Create Custom Circle Marker
      const circle = L.circleMarker([inc.latitude, inc.longitude], {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        fillOpacity: 0.85
      }).addTo(map);

      // Popup Content showing short details
      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 0.85rem; color: #fff; width: 180px;">
          <h4 style="margin: 0 0 6px 0; font-family: 'Outfit'; font-size: 0.95rem; color: #fff;">${inc.category}</h4>
          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.7rem; color: ${color};">${inc.severity}</span>
            <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.7rem; color: #00F2FE;">P: ${inc.priority_score}</span>
          </div>
          <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${inc.address || 'Delhi'}</p>
          <div style="font-weight: 500; font-size: 0.75rem;">Status: <span style="color: #00F2FE;">${inc.status}</span></div>
        </div>
      `;
      circle.bindPopup(popupContent, { closeButton: false });

      // Click event
      circle.on('click', () => {
        if (onIncidentSelect) {
          onIncidentSelect(inc.id);
        }
      });

      incidentMarkersRef.current[inc.id] = circle;
    });

  }, [incidents, mode]);

  // Search Address handler (Nominatim API)
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(null);

    try {
      // Append "India" to search bounds to keep results relevant
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', India')}&limit=1`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lon);

        if (mode === 'pick' && onChange) {
          onChange({ lat: parsedLat, lng: parsedLng, address: display_name });
        } else if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([parsedLat, parsedLng], 14);
        }
      } else {
        setSearchError('Location not found. Please check name and try again.');
      }
    } catch (err) {
      console.error('[Map Search Error]', err);
      setSearchError('Failed to search location.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Get current device GPS location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mode === 'pick' && onChange) {
          onChange({ lat: latitude, lng: longitude });
        } else if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
        }
      },
      (error) => {
        console.warn('[Map Geolocation Alert]', error);
        alert('Could not determine GPS location automatically. Please select it manually.');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '350px' }}>
      
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '56px',
        right: '12px',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
      }}>
        {/* Search input form */}
        <form onSubmit={handleSearch} style={{ flexGrow: 1, display: 'flex', gap: '4px' }}>
          <input 
            type="text" 
            placeholder="Search city, sector or landmark in India..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{
              padding: '8px 12px',
              fontSize: '0.85rem',
              height: '38px',
              background: 'rgba(7, 9, 19, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              borderRadius: '8px'
            }}
          />
          <button 
            type="submit" 
            disabled={searchLoading}
            className="btn btn-secondary"
            style={{ 
              padding: '0 12px', 
              height: '38px',
              background: 'rgba(7, 9, 19, 0.95)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px'
            }}
          >
            <Search size={16} />
          </button>
        </form>

        {/* Detect location action */}
        <button
          type="button"
          onClick={handleGetLocation}
          className="btn btn-primary"
          title="Auto-detect current location"
          style={{ 
            padding: '0 12px', 
            height: '38px', 
            width: '38px',
            borderRadius: '8px'
          }}
        >
          <Navigation size={16} />
        </button>
      </div>

      {searchError && (
        <div style={{
          position: 'absolute',
          top: '55px',
          left: '56px',
          right: '12px',
          zIndex: 1000,
          background: 'rgba(255, 0, 85, 0.95)',
          color: '#ffffff',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 600,
          textAlign: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}>
          {searchError}
        </div>
      )}

      {/* Actual Map Target */}
      <div 
        ref={mapContainerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          minHeight: '350px',
          borderRadius: '12px'
        }} 
      />
    </div>
  );
}
