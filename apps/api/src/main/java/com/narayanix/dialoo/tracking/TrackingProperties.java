package com.narayanix.dialoo.tracking;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Every tracking tunable (application.yml -> app.tracking.*, each overridable by an environment variable). Defaults mirror the product spec. */
@Component @ConfigurationProperties(prefix = "app.tracking")
public class TrackingProperties {
  private int gpsIntervalSeconds = 10;
  private int stationaryIntervalSeconds = 30;
  private double minDistanceMeters = 15;
  private int persistIntervalSeconds = 60;
  private int staleWarningSeconds = 30;
  private int unavailableSeconds = 90;
  private double arrivalRadiusMeters = 100;
  private double approachingRadiusMeters = 500;
  private double maxAccuracyMeters = 100;
  private double arrivalMaxAccuracyMeters = 75;
  private double maxSpeedMps = 45;
  private int maxFixAgeSeconds = 120;
  private int maxFutureSkewSeconds = 30;
  private long minUpdateGapMillis = 1500;
  private int sessionMaxHours = 8;
  private int historyRetentionDays = 7;
  private int routesRefreshSeconds = 300;
  private int routesMinGapSeconds = 30;
  private double routeDeviationMeters = 150;
  private int routesDailyLimit = 3000;
  private String routesTravelMode = "DRIVE";
  private String routesPreference = "TRAFFIC_UNAWARE";
  private double fallbackSpeedKmh = 25;
  private double nearbyDefaultRadiusKm = 5;
  private double nearbyMaxRadiusKm = 20;
  private int partnerLocationFreshSeconds = 300;
  private int partnerPresenceMinGapSeconds = 20;
  private int autocompleteDebounceMillis = 400;

  public int getGpsIntervalSeconds() { return gpsIntervalSeconds; }
  public void setGpsIntervalSeconds(int v) { this.gpsIntervalSeconds = v; }
  public int getStationaryIntervalSeconds() { return stationaryIntervalSeconds; }
  public void setStationaryIntervalSeconds(int v) { this.stationaryIntervalSeconds = v; }
  public double getMinDistanceMeters() { return minDistanceMeters; }
  public void setMinDistanceMeters(double v) { this.minDistanceMeters = v; }
  public int getPersistIntervalSeconds() { return persistIntervalSeconds; }
  public void setPersistIntervalSeconds(int v) { this.persistIntervalSeconds = v; }
  public int getStaleWarningSeconds() { return staleWarningSeconds; }
  public void setStaleWarningSeconds(int v) { this.staleWarningSeconds = v; }
  public int getUnavailableSeconds() { return unavailableSeconds; }
  public void setUnavailableSeconds(int v) { this.unavailableSeconds = v; }
  public double getArrivalRadiusMeters() { return arrivalRadiusMeters; }
  public void setArrivalRadiusMeters(double v) { this.arrivalRadiusMeters = v; }
  public double getApproachingRadiusMeters() { return approachingRadiusMeters; }
  public void setApproachingRadiusMeters(double v) { this.approachingRadiusMeters = v; }
  public double getMaxAccuracyMeters() { return maxAccuracyMeters; }
  public void setMaxAccuracyMeters(double v) { this.maxAccuracyMeters = v; }
  public double getArrivalMaxAccuracyMeters() { return arrivalMaxAccuracyMeters; }
  public void setArrivalMaxAccuracyMeters(double v) { this.arrivalMaxAccuracyMeters = v; }
  public double getMaxSpeedMps() { return maxSpeedMps; }
  public void setMaxSpeedMps(double v) { this.maxSpeedMps = v; }
  public int getMaxFixAgeSeconds() { return maxFixAgeSeconds; }
  public void setMaxFixAgeSeconds(int v) { this.maxFixAgeSeconds = v; }
  public int getMaxFutureSkewSeconds() { return maxFutureSkewSeconds; }
  public void setMaxFutureSkewSeconds(int v) { this.maxFutureSkewSeconds = v; }
  public long getMinUpdateGapMillis() { return minUpdateGapMillis; }
  public void setMinUpdateGapMillis(long v) { this.minUpdateGapMillis = v; }
  public int getSessionMaxHours() { return sessionMaxHours; }
  public void setSessionMaxHours(int v) { this.sessionMaxHours = v; }
  public int getHistoryRetentionDays() { return historyRetentionDays; }
  public void setHistoryRetentionDays(int v) { this.historyRetentionDays = v; }
  public int getRoutesRefreshSeconds() { return routesRefreshSeconds; }
  public void setRoutesRefreshSeconds(int v) { this.routesRefreshSeconds = v; }
  public int getRoutesMinGapSeconds() { return routesMinGapSeconds; }
  public void setRoutesMinGapSeconds(int v) { this.routesMinGapSeconds = v; }
  public double getRouteDeviationMeters() { return routeDeviationMeters; }
  public void setRouteDeviationMeters(double v) { this.routeDeviationMeters = v; }
  public int getRoutesDailyLimit() { return routesDailyLimit; }
  public void setRoutesDailyLimit(int v) { this.routesDailyLimit = v; }
  public String getRoutesTravelMode() { return routesTravelMode; }
  public void setRoutesTravelMode(String v) { this.routesTravelMode = v; }
  public String getRoutesPreference() { return routesPreference; }
  public void setRoutesPreference(String v) { this.routesPreference = v; }
  public double getFallbackSpeedKmh() { return fallbackSpeedKmh; }
  public void setFallbackSpeedKmh(double v) { this.fallbackSpeedKmh = v; }
  public double getNearbyDefaultRadiusKm() { return nearbyDefaultRadiusKm; }
  public void setNearbyDefaultRadiusKm(double v) { this.nearbyDefaultRadiusKm = v; }
  public double getNearbyMaxRadiusKm() { return nearbyMaxRadiusKm; }
  public void setNearbyMaxRadiusKm(double v) { this.nearbyMaxRadiusKm = v; }
  public int getPartnerLocationFreshSeconds() { return partnerLocationFreshSeconds; }
  public void setPartnerLocationFreshSeconds(int v) { this.partnerLocationFreshSeconds = v; }
  public int getPartnerPresenceMinGapSeconds() { return partnerPresenceMinGapSeconds; }
  public void setPartnerPresenceMinGapSeconds(int v) { this.partnerPresenceMinGapSeconds = v; }
  public int getAutocompleteDebounceMillis() { return autocompleteDebounceMillis; }
  public void setAutocompleteDebounceMillis(int v) { this.autocompleteDebounceMillis = v; }
}
