// config.ts - Configuration constants for Property Risk Analytics Dashboard

import type { PerilOverlay } from './types';

// API Keys (from environment)
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiZWxldmF0ZW5vdyIsImEiOiJjbWlqZDczejExNGJyM2NxODNtcjk4NXZzIn0.-boLEfnCFHAxHsD7XoazkA';
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// AI Agent Configuration
export const AI_AGENT_URL = 'http://16.170.162.72:8004/query';
export const AI_AGENT_ID = 'd7962a5a-2d8b-4b9f-94dc-90186347cf81';

// Tile Proxy Configuration
export const USE_LOCAL_PROXY = true;
export const LOCAL_PROXY = 'https://small-darkness-6289.vs-ca9.workers.dev/tile?';
export const PUBLIC_PROXY = 'https://corsproxy.io/?';

// Example queries for placeholder rotation
export const EXAMPLE_QUERIES = [
  'Show me duplicate locations',
  'Find locations with data conflicts',
  'Which locations need enrichment',
  'Show customer 360 for Freedom Office Trust',
  'Locations with sprinkler conflicts',
  'Properties missing construction data',
  'High value buildings in California',
  'Healthcare locations with stale inspections',
  'Show all locations for University of LA',
  'Find conflicts from ISO reports',
  'Locations submitted multiple times',
  'Properties needing Nearmap enrichment',
];

// Peril Overlay Configuration - Using ArcGIS REST export services via tile proxy
export const PERIL_OVERLAYS: Record<string, PerilOverlay> = {
  wildfire: {
    id: 'wildfire',
    name: 'Wildfire Risk',
    icon: '🔥',
    color: '#f97316',
    description: 'USFS Wildfire Hazard Potential',
    tiles: [
      `https://small-darkness-6289.vs-ca9.workers.dev/tile?base=${encodeURIComponent('https://apps.fs.usda.gov/arcx/rest/services/RDW_Wildfire/ProbabilisticWildfireRisk/MapServer/export')}&bbox={bbox-epsg-3857}`
    ],
    legendItems: [
      { color: '#fee08b', label: 'Low' },
      { color: '#fdae61', label: 'Moderate' },
      { color: '#f46d43', label: 'High' },
    ]
  },
  hurricane: {
    id: 'hurricane',
    name: 'Hurricane Zones',
    icon: '🌀',
    color: '#8b5cf6',
    description: 'NOAA Coastal Flood Hazard',
    tiles: [
      `https://small-darkness-6289.vs-ca9.workers.dev/tile?base=${encodeURIComponent('https://coast.noaa.gov/arcgis/rest/services/FloodExposureMapper/CFEM_CoastalFloodHazardComposite/MapServer/export')}&bbox={bbox-epsg-3857}`
    ],
    legendItems: [
      { color: '#c4b5fd', label: 'Cat 1-2' },
      { color: '#8b5cf6', label: 'Cat 3' },
      { color: '#5b21b6', label: 'Cat 4-5' },
    ]
  },
  flood: {
    id: 'flood',
    name: 'Flood Zones',
    icon: '🌊',
    color: '#3b82f6',
    description: 'FEMA Flood Hazard',
    tiles: [
      `https://small-darkness-6289.vs-ca9.workers.dev/tile?base=${encodeURIComponent('https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/export')}&bbox={bbox-epsg-3857}&layers=show:28`
    ],
    legendItems: [
      { color: '#93c5fd', label: 'Zone X' },
      { color: '#3b82f6', label: 'Zone A' },
      { color: '#1e3a8a', label: 'Zone V' },
    ]
  },
  earthquake: {
    id: 'earthquake',
    name: 'Seismic Hazard',
    icon: '📳',
    color: '#eab308',
    description: 'USGS Seismic Hazard',
    tiles: [
      `https://small-darkness-6289.vs-ca9.workers.dev/tile?base=${encodeURIComponent('https://earthquake.usgs.gov/arcgis/rest/services/haz/hazmap2018/MapServer/export')}&bbox={bbox-epsg-3857}`
    ],
    legendItems: [
      { color: '#fef08a', label: 'Moderate' },
      { color: '#eab308', label: 'High' },
      { color: '#b45309', label: 'Very High' },
    ]
  },
};

// TIV color thresholds for markers
export const TIV_COLORS = {
  low: '#3b82f6',       // <$500K - Blue
  medium: '#22c55e',    // $500K-$2M - Green
  high: '#eab308',      // $2M-$10M - Yellow
  veryHigh: '#f97316',  // $10M-$50M - Orange
  extreme: '#ef4444',   // >$50M - Red
};

// Risk score color thresholds
export const RISK_COLORS = {
  low: '#22c55e',       // 1-3 - Green
  moderate: '#eab308',  // 4-5 - Yellow
  high: '#f97316',      // 6-7 - Orange
  severe: '#ef4444',    // 8-10 - Red
};