import React, { useCallback, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '480px',
  borderRadius: '0px'
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629
};

const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ]
};

const MapComponent = ({ origin, destination, ambulanceLocation }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [map, setMap] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);

  const onLoad = useCallback(function callback(map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  // Fetch directions if origin and destination are provided
  React.useEffect(() => {
    if (isLoaded && origin && destination) {
        // eslint-disable-next-line no-undef
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin: origin,
                destination: destination,
                // eslint-disable-next-line no-undef
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                // eslint-disable-next-line no-undef
                if (status === google.maps.DirectionsStatus.OK) {
                    setDirectionsResponse(result);
                } else {
                    console.error("Error fetching directions:", status);
                }
            }
        );
    }
  }, [isLoaded, origin, destination]);

  // Build ambulance icon object when map is loaded
  const ambulanceIcon = isLoaded ? {
      // eslint-disable-next-line no-undef
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="#dc2626" stroke="#fff" stroke-width="3"/>
          <text x="24" y="30" text-anchor="middle" font-size="22" fill="#fff">🚑</text>
        </svg>
      `),
      // eslint-disable-next-line no-undef
      scaledSize: new google.maps.Size(48, 48),
      // eslint-disable-next-line no-undef
      anchor: new google.maps.Point(24, 24),
  } : null;

  const pickupIcon = isLoaded ? {
      // eslint-disable-next-line no-undef
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#2563eb" stroke="#fff" stroke-width="3"/>
          <text x="18" y="24" text-anchor="middle" font-size="16" fill="#fff">📍</text>
        </svg>
      `),
      // eslint-disable-next-line no-undef
      scaledSize: new google.maps.Size(36, 36),
      // eslint-disable-next-line no-undef
      anchor: new google.maps.Point(18, 18),
  } : null;

  const hospitalIcon = isLoaded ? {
      // eslint-disable-next-line no-undef
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#059669" stroke="#fff" stroke-width="3"/>
          <text x="18" y="24" text-anchor="middle" font-size="16" fill="#fff">🏥</text>
        </svg>
      `),
      // eslint-disable-next-line no-undef
      scaledSize: new google.maps.Size(36, 36),
      // eslint-disable-next-line no-undef
      anchor: new google.maps.Point(18, 18),
  } : null;

  return isLoaded ? (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={ambulanceLocation || origin || defaultCenter}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {origin && <Marker position={origin} icon={pickupIcon} title="Pickup Location" />}
        {destination && <Marker position={destination} icon={hospitalIcon} title="Hospital" />}
        {ambulanceLocation && (
            <Marker
                position={ambulanceLocation}
                icon={ambulanceIcon}
                title="Ambulance"
            />
        )}
        {directionsResponse && (
            <DirectionsRenderer
                directions={directionsResponse}
                options={{
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: '#dc2626',
                        strokeWeight: 4,
                        strokeOpacity: 0.8,
                    }
                }}
            />
        )}
      </GoogleMap>
  ) : (
    <div style={{
        height: '100%',
        minHeight: '480px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        flexDirection: 'column',
        gap: '12px'
    }}>
        <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid #e5e7eb',
            borderTopColor: '#dc2626',
            animation: 'spin 0.8s linear infinite'
        }}></div>
        <span style={{ color: '#9ca3af', fontSize: '14px' }}>Loading Map...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default React.memo(MapComponent);
