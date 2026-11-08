/** Google map styling that follows the demo's illustrated map: ivory land, soft green parks, pale blue water. */
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f0e6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5d6b62' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f6ef' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#cfe3c1' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4f6457' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fbfaf5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f6efd9' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b9dcef' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4b7f9c' }] },
];
