/**
 * Computes the distance between two geographical points using the Haversine formula.
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in meters
 */
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRadians = (deg: number) => deg * (Math.PI / 180);

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Checks if a given coordinate is within a geofenced area.
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param fenceLat Geofence center latitude
 * @param fenceLon Geofence center longitude
 * @param radius Radius in meters
 * @returns true if within geofence, false otherwise
 */
export function isWithinGeofence(userLat: number, userLon: number, fenceLat: number, fenceLon: number, radius: number): boolean {
  const distance = getDistanceInMeters(userLat, userLon, fenceLat, fenceLon);
  return distance <= radius;
}
