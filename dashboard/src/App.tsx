import { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import portfolioData from './data/portfolio.json';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

interface Location {
  location_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  total_tiv: number;
  hurricane: number;
  earthquake: number;
  flood_score: number;
  flood_zone: string;
  wildfire: number;
  tornado_hail: number;
  terrorism: number;
  surge_risk: number;
  total_claims: number;
  total_incurred: number;
  construction_code: string;
  year_built: number;
  sprinkler_status: string;
  has_recommendations: string;
  rc_title: string;
  rc_text: string;
  named_insured?: string;
  occupancy_desc?: string;
  sq_footage?: number;
  [key: string]: any;
}

interface ActiveFilter {
  id: string;
  label: string;
  type: string;
}

interface SearchResult {
  locations: Location[];
  filters: ActiveFilter[];
  interpretation: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const getMarkerColor = (tiv: number): string => {
  if (tiv < 500000) return '#3b82f6';
  if (tiv < 2000000) return '#22c55e';
  if (tiv < 10000000) return '#eab308';
  if (tiv < 50000000) return '#f97316';
  return '#ef4444';
};

const getRiskColor = (score: number): string => {
  if (score <= 3) return '#22c55e';
  if (score <= 5) return '#eab308';
  if (score <= 7) return '#f97316';
  return '#ef4444';
};

// Smart Query Parser - interprets natural language and returns filters
const parseQuery = (query: string, locations: Location[]): SearchResult => {
  const q = query.toLowerCase().trim();
  
  if (!q || q === 'all' || q === 'reset' || q === 'clear' || q === 'show all') {
    return { 
      locations, 
      filters: [], 
      interpretation: 'Showing all locations' 
    };
  }

  let result = [...locations];
  const filters: ActiveFilter[] = [];
  const interpretations: string[] = [];

  // State filters
  const stateMap: Record<string, string> = {
    'florida': 'FL', 'fl': 'FL',
    'california': 'CA', 'ca': 'CA', 'cali': 'CA',
    'texas': 'TX', 'tx': 'TX',
    'new york': 'NY', 'ny': 'NY', 'nyc': 'NY', 'manhattan': 'NY',
    'illinois': 'IL', 'il': 'IL', 'chicago': 'IL',
    'massachusetts': 'MA', 'ma': 'MA', 'boston': 'MA',
    'washington': 'WA', 'wa': 'WA', 'seattle': 'WA',
    'new jersey': 'NJ', 'nj': 'NJ',
    'georgia': 'GA', 'ga': 'GA', 'atlanta': 'GA',
    'pennsylvania': 'PA', 'pa': 'PA', 'philadelphia': 'PA', 'philly': 'PA',
    'miami': 'FL', 'brickell': 'FL',
  };

  for (const [keyword, state] of Object.entries(stateMap)) {
    if (q.includes(keyword)) {
      result = result.filter(l => l.state === state);
      filters.push({ id: `state-${state}`, label: state, type: 'state' });
      interpretations.push(state);
      break;
    }
  }

  // City-specific filters
  const cityMap: Record<string, string> = {
    'times square': 'New York',
    'midtown': 'New York',
    'downtown la': 'Los Angeles',
    'century city': 'Los Angeles',
    'loop': 'Chicago',
    'costa mesa': 'Costa Mesa',
    'austin': 'Austin',
    'dallas': 'Dallas',
    'houston': 'Houston',
    'jersey city': 'Jersey City',
  };

  for (const [keyword, city] of Object.entries(cityMap)) {
    if (q.includes(keyword)) {
      result = result.filter(l => l.city === city);
      filters.push({ id: `city-${city}`, label: city, type: 'city' });
      interpretations.push(city);
      break;
    }
  }

  // Peril filters - hurricane
  if (q.includes('hurricane') || q.includes('wind')) {
    const highRisk = q.includes('high') || q.includes('severe') || q.includes('extreme');
    const threshold = highRisk ? 7 : 5;
    result = result.filter(l => l.hurricane >= threshold);
    filters.push({ id: 'hurricane', label: `Hurricane ≥${threshold}`, type: 'peril' });
    interpretations.push(`high hurricane risk`);
  }

  // Peril filters - earthquake
  if (q.includes('earthquake') || q.includes('seismic')) {
    const highRisk = q.includes('high') || q.includes('severe');
    const threshold = highRisk ? 7 : 5;
    result = result.filter(l => l.earthquake >= threshold);
    filters.push({ id: 'earthquake', label: `Earthquake ≥${threshold}`, type: 'peril' });
    interpretations.push(`earthquake exposure`);
  }

  // Peril filters - flood
  if (q.includes('flood')) {
    const highRisk = q.includes('high') || q.includes('zone a') || q.includes('severe');
    const threshold = highRisk ? 5 : 3;
    result = result.filter(l => l.flood_score >= threshold);
    filters.push({ id: 'flood', label: `Flood ≥${threshold}`, type: 'peril' });
    interpretations.push(`flood risk`);
  }

  // Peril filters - wildfire
  if (q.includes('wildfire') || q.includes('fire risk') || q.includes('brush')) {
    result = result.filter(l => l.wildfire >= 4);
    filters.push({ id: 'wildfire', label: 'Wildfire ≥4', type: 'peril' });
    interpretations.push(`wildfire exposure`);
  }

  // Peril filters - tornado/hail
  if (q.includes('tornado') || q.includes('hail') || q.includes('convective')) {
    result = result.filter(l => l.tornado_hail >= 5);
    filters.push({ id: 'tornado', label: 'Tornado/Hail ≥5', type: 'peril' });
    interpretations.push(`tornado/hail risk`);
  }

  // Peril filters - terrorism
  if (q.includes('terrorism') || q.includes('terror')) {
    result = result.filter(l => l.terrorism >= 7);
    filters.push({ id: 'terrorism', label: 'Terrorism ≥7', type: 'peril' });
    interpretations.push(`terrorism exposure`);
  }

  // Peril filters - storm surge
  if (q.includes('surge') || q.includes('storm surge') || q.includes('coastal')) {
    result = result.filter(l => l.surge_risk >= 5);
    filters.push({ id: 'surge', label: 'Surge ≥5', type: 'peril' });
    interpretations.push(`storm surge risk`);
  }

  // TIV filters
  if (q.includes('high value') || q.includes('large') || q.includes('big') || q.match(/over\s*\$?\d+\s*m/i) || q.includes('tiv over') || q.includes('above 50') || q.includes('over 50')) {
    const match = q.match(/(\d+)\s*m/i);
    const threshold = match ? parseInt(match[1]) * 1000000 : 50000000;
    result = result.filter(l => l.total_tiv >= threshold);
    filters.push({ id: 'high-tiv', label: `TIV ≥${formatCurrency(threshold)}`, type: 'tiv' });
    interpretations.push(`high value`);
  }

  if (q.includes('small') || q.includes('low value') || q.includes('under 10') || q.includes('below 10')) {
    result = result.filter(l => l.total_tiv < 10000000);
    filters.push({ id: 'low-tiv', label: 'TIV <$10M', type: 'tiv' });
    interpretations.push(`smaller properties`);
  }

  // Sprinkler/Protection filters
  if (q.includes('sprinkler') || q.includes('protected') || q.includes('fire protected')) {
    if (q.includes('no ') || q.includes('not ') || q.includes('without') || q.includes('unprotected') || q.includes('non-sprinkler')) {
      result = result.filter(l => l.sprinkler_status !== 'Fully Sprinklered');
      filters.push({ id: 'no-sprinkler', label: 'Not Sprinklered', type: 'protection' });
      interpretations.push(`not sprinklered`);
    } else {
      result = result.filter(l => l.sprinkler_status === 'Fully Sprinklered');
      filters.push({ id: 'sprinkler', label: 'Sprinklered', type: 'protection' });
      interpretations.push(`sprinklered`);
    }
  }

  // Construction filters
  if (q.includes('frame') || q.includes('wood')) {
    result = result.filter(l => l.construction_code === '1');
    filters.push({ id: 'frame', label: 'Frame Construction', type: 'construction' });
    interpretations.push(`frame construction`);
  }

  if (q.includes('fire resistive') || q.includes('class 6') || q.includes('steel')) {
    result = result.filter(l => l.construction_code === '6');
    filters.push({ id: 'fire-resistive', label: 'Fire Resistive', type: 'construction' });
    interpretations.push(`fire resistive`);
  }

  if (q.includes('masonry')) {
    result = result.filter(l => ['2', '4'].includes(l.construction_code));
    filters.push({ id: 'masonry', label: 'Masonry', type: 'construction' });
    interpretations.push(`masonry construction`);
  }

  // Age filters
  if (q.includes('old') || q.includes('vintage') || q.includes('pre-1980') || q.includes('before 1980') || q.includes('aging')) {
    result = result.filter(l => l.year_built < 1980);
    filters.push({ id: 'old', label: 'Built before 1980', type: 'age' });
    interpretations.push(`older buildings`);
  }

  if (q.includes('new') || q.includes('recent') || q.includes('modern') || q.includes('after 2010') || q.includes('post-2010')) {
    result = result.filter(l => l.year_built >= 2010);
    filters.push({ id: 'new', label: 'Built 2010+', type: 'age' });
    interpretations.push(`newer buildings`);
  }

  // Risk control / recommendations
  if (q.includes('recommendation') || q.includes('alert') || q.includes('action') || q.includes('risk control') || q.includes('attention') || q.includes('issues') || q.includes('concerns') || q.includes('gaps')) {
    result = result.filter(l => l.has_recommendations === 'Y');
    filters.push({ id: 'recommendations', label: 'Has Alerts', type: 'status' });
    interpretations.push(`with recommendations`);
  }

  // Claims filters
  if (q.includes('claims') || q.includes('losses') || q.includes('loss history')) {
    if (q.includes('high') || q.includes('many') || q.includes('frequent')) {
      result = result.filter(l => l.total_claims >= 30);
      filters.push({ id: 'high-claims', label: 'Claims ≥30', type: 'claims' });
      interpretations.push(`high claims`);
    } else if (q.includes('no ') || q.includes('zero') || q.includes('clean')) {
      result = result.filter(l => l.total_claims === 0);
      filters.push({ id: 'no-claims', label: 'No Claims', type: 'claims' });
      interpretations.push(`no claims`);
    } else {
      result = result.filter(l => l.total_claims > 0);
      filters.push({ id: 'has-claims', label: 'Has Claims', type: 'claims' });
      interpretations.push(`with claims`);
    }
  }

  // Occupancy filters
  if (q.includes('office')) {
    result = result.filter(l => l.occupancy_desc?.toLowerCase().includes('office'));
    filters.push({ id: 'office', label: 'Office', type: 'occupancy' });
    interpretations.push(`office`);
  }

  if (q.includes('retail') || q.includes('mercantile') || q.includes('mall') || q.includes('shopping')) {
    result = result.filter(l => l.occupancy_desc?.toLowerCase().includes('mercantile') || l.occupancy_desc?.toLowerCase().includes('retail'));
    filters.push({ id: 'retail', label: 'Retail', type: 'occupancy' });
    interpretations.push(`retail`);
  }

  if (q.includes('warehouse') || q.includes('distribution')) {
    result = result.filter(l => l.occupancy_desc?.toLowerCase().includes('warehouse'));
    filters.push({ id: 'warehouse', label: 'Warehouse', type: 'occupancy' });
    interpretations.push(`warehouse`);
  }

  if (q.includes('high rise') || q.includes('highrise') || q.includes('tall') || q.includes('tower')) {
    result = result.filter(l => l.occupancy_desc?.toLowerCase().includes('high rise'));
    filters.push({ id: 'highrise', label: 'High Rise', type: 'occupancy' });
    interpretations.push(`high rise`);
  }

  // Address/location search (fallback)
  if (filters.length === 0) {
    const addressMatch = locations.filter(l => 
      l.address.toLowerCase().includes(q) || 
      l.city.toLowerCase().includes(q) ||
      l.named_insured?.toLowerCase().includes(q) ||
      l.location_id.toLowerCase().includes(q)
    );
    if (addressMatch.length > 0) {
      result = addressMatch;
      interpretations.push(`matching "${query}"`);
    }
  }

  // Build interpretation string
  let interpretation = '';
  if (result.length === 0) {
    interpretation = `No locations match: ${query}`;
  } else if (interpretations.length > 0) {
    interpretation = `${result.length} location${result.length !== 1 ? 's' : ''}: ${interpretations.join(' + ')}`;
  } else {
    interpretation = `${result.length} location${result.length !== 1 ? 's' : ''} found`;
  }

  return { locations: result, filters, interpretation };
};

// Example queries for placeholder rotation
const EXAMPLE_QUERIES = [
  'Florida properties with hurricane risk',
  'High value buildings in New York',
  'Sprinklered properties in California',
  'Locations with risk control alerts',
  'Earthquake exposure in San Francisco',
  'Old buildings needing attention',
  'High rise offices in Chicago',
  'Properties with high claims',
  'Coastal surge risk locations',
  'Times Square properties',
];

// AI Agent Configuration
const AI_AGENT_URL = 'http://16.170.162.72:8004/query';
const AI_AGENT_ID = 'd7962a5a-2d8b-4b9f-94dc-90186347cf81';

// Generate random thread ID for each session
const generateThreadId = () => Math.floor(Math.random() * 1000000);

// CORS Proxy - set to false to use public proxy, true for local
const USE_LOCAL_PROXY = true; // Using local proxy for better control
const LOCAL_PROXY = 'http://localhost:3001/tile?';
const PUBLIC_PROXY = 'https://corsproxy.io/?';

// For local proxy, we pass parameters differently
const buildTileUrl = (baseUrl: string) => {
  if (USE_LOCAL_PROXY) {
    // Local proxy: pass base URL and let it handle bbox substitution
    return `${LOCAL_PROXY}base=${encodeURIComponent(baseUrl)}`;
  } else {
    // Public proxy: just wrap the full URL
    return PUBLIC_PROXY + encodeURIComponent(baseUrl);
  }
};

// Peril Overlay Configuration - Using ArcGIS REST export services
const PERIL_OVERLAYS: Record<string, {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  tiles: string[];
  legendItems: { color: string; label: string }[];
}> = {
  wildfire: {
    id: 'wildfire',
    name: 'Wildfire Risk',
    icon: '🔥',
    color: '#f97316',
    description: 'USFS Wildfire Hazard Potential',
    tiles: [
      `http://localhost:3001/tile?base=${encodeURIComponent('https://apps.fs.usda.gov/arcx/rest/services/RDW_Wildfire/ProbabilisticWildfireRisk/MapServer/export')}&bbox={bbox-epsg-3857}`
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
      `http://localhost:3001/tile?base=${encodeURIComponent('https://coast.noaa.gov/arcgis/rest/services/FloodExposureMapper/CFEM_CoastalFloodHazardComposite/MapServer/export')}&bbox={bbox-epsg-3857}`
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
      `http://localhost:3001/tile?base=${encodeURIComponent('https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/export')}&bbox={bbox-epsg-3857}&layers=show:28`
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
      `http://localhost:3001/tile?base=${encodeURIComponent('https://earthquake.usgs.gov/arcgis/rest/services/haz/hazmap2018/MapServer/export')}&bbox={bbox-epsg-3857}`
    ],
    legendItems: [
      { color: '#fef08a', label: 'Moderate' },
      { color: '#eab308', label: 'High' },
      { color: '#b45309', label: 'Very High' },
    ]
  },
};

// Process AI Agent response and execute actions
const processAgentResponse = (agentResponse: any, allLocations: Location[]) => {
  // API returns { response: "stringified JSON" } - need to parse it
  let result;
  
  if (agentResponse.response) {
    // Response is a stringified JSON inside response field
    try {
      result = JSON.parse(agentResponse.response);
    } catch (e) {
      console.error('Failed to parse agent response:', e);
      result = {};
    }
  } else if (agentResponse.metadata) {
    // Alternative format: wrapped in metadata
    result = agentResponse.metadata;
  } else {
    // Direct response format
    result = agentResponse;
  }
  
  const responseText = result.response_text || '';
  const actions = result.actions || [];
  const suggestions = result.follow_up_suggestions || [];
  
  let filteredLocs = allLocations;
  let selectedLoc: Location | null = null;
  let mapBounds: { north: number; south: number; east: number; west: number } | null = null;
  
  // Process each action
  actions.forEach((action: any) => {
    switch (action.type) {
      case 'filter_locations':
        if (action.location_ids && action.location_ids.length > 0) {
          filteredLocs = allLocations.filter(loc => 
            action.location_ids.includes(loc.location_id)
          );
        }
        break;
        
      case 'select_location':
        if (action.location_id) {
          selectedLoc = allLocations.find(loc => loc.location_id === action.location_id) || null;
        }
        break;
        
      case 'zoom_map':
        if (action.bounds) {
          mapBounds = action.bounds;
        }
        break;
        
      case 'clear_filters':
        filteredLocs = allLocations;
        break;
        
      case 'highlight_locations':
        // For now, treat highlight same as filter
        if (action.location_ids && action.location_ids.length > 0) {
          filteredLocs = allLocations.filter(loc => 
            action.location_ids.includes(loc.location_id)
          );
        }
        break;
    }
  });
  
  return {
    filteredLocations: filteredLocs,
    selectedLocation: selectedLoc,
    interpretation: `🤖 ${responseText}`,
    mapBounds,
    suggestions
  };
};

export default function App() {
  const [locations] = useState<Location[]>(portfolioData as Location[]);
  const [filtered, setFiltered] = useState<Location[]>(portfolioData as Location[]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredKpi, setHoveredKpi] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'street' | 'satellite'>('street');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [interpretation, setInterpretation] = useState<string>('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showExamples, setShowExamples] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiResponseExpanded, setAiResponseExpanded] = useState(true);
  const [activeOverlays, setActiveOverlays] = useState<string[]>([]);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const stats = {
    count: filtered.length,
    tiv: filtered.reduce((s, l) => s + l.total_tiv, 0),
    claims: filtered.reduce((s, l) => s + l.total_claims, 0),
    incurred: filtered.reduce((s, l) => s + l.total_incurred, 0),
    alerts: filtered.filter(l => l.has_recommendations === 'Y').length,
  };

  // Rotate placeholder examples
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % EXAMPLE_QUERIES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98, 39],
      zoom: 4,
    });

    map.current.on('load', () => setMapReady(true));
    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle peril overlay toggling - using canvas overlay approach
  useEffect(() => {
    if (!map.current || !mapReady) return;

    Object.entries(PERIL_OVERLAYS).forEach(([key, config]) => {
      const sourceId = `${key}-source`;
      const layerId = `${key}-layer`;
      const isActive = activeOverlays.includes(key);

      const sourceExists = map.current!.getSource(sourceId);

      if (isActive && !sourceExists) {
        // Use the raw tile URL (proxy handles CORS)
        // For ArcGIS MapServer export, we need to use it as a raster source
        // but with proper tile scheme
        
        const baseUrl = config.tiles[0];
        
        // Create a custom tile URL function that properly encodes the bbox
        const tileUrl = baseUrl;
        
        map.current!.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          scheme: 'xyz'
        });

        // Find first symbol layer to insert below
        const layers = map.current!.getStyle().layers;
        let firstSymbolId: string | undefined;
        for (const layer of layers) {
          if (layer.type === 'symbol') {
            firstSymbolId = layer.id;
            break;
          }
        }

        map.current!.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': 0.65,
            'raster-fade-duration': 0,
          },
        }, firstSymbolId);

      } else if (!isActive && sourceExists) {
        if (map.current!.getLayer(layerId)) {
          map.current!.removeLayer(layerId);
        }
        map.current!.removeSource(sourceId);
      }
    });
  }, [activeOverlays, mapReady]);

  // Toggle overlay function
  const toggleOverlay = (overlayId: string) => {
    setActiveOverlays(prev => 
      prev.includes(overlayId) 
        ? prev.filter(id => id !== overlayId)
        : [...prev, overlayId]
    );
  };

  // Auto-zoom to filtered results
  const zoomToLocations = (locs: Location[]) => {
    if (!map.current || locs.length === 0) return;

    if (locs.length === 1) {
      map.current.flyTo({
        center: [locs[0].lon, locs[0].lat],
        zoom: 14,
        duration: 1500,
      });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      locs.forEach(loc => bounds.extend([loc.lon, loc.lat]));
      map.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: selected ? 500 : 100 },
        duration: 1500,
        maxZoom: 12,
      });
    }
  };

  // Update markers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    markers.current.forEach(m => m.remove());
    markers.current = [];

    filtered.forEach((loc) => {
      const el = document.createElement('div');
      const color = getMarkerColor(loc.total_tiv);
      const hasAlert = loc.has_recommendations === 'Y';
      
      el.style.width = hasAlert ? '18px' : '16px';
      el.style.height = hasAlert ? '18px' : '16px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.border = hasAlert ? '3px solid #fbbf24' : '2px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = hasAlert ? `0 0 12px #fbbf24` : '0 2px 6px rgba(0,0,0,0.4)';
      
      el.onmouseenter = () => {
        el.style.boxShadow = `0 0 16px 4px ${color}`;
      };
      
      el.onmouseleave = () => {
        el.style.boxShadow = hasAlert ? `0 0 12px #fbbf24` : '0 2px 6px rgba(0,0,0,0.4)';
      };
      
      el.onclick = (e) => {
        e.stopPropagation();
        setSelected(loc);
        setViewMode('street');
      };

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([loc.lon, loc.lat])
        .addTo(map.current!);
      
      markers.current.push(marker);
    });
  }, [filtered, mapReady]);

  // Smart Search Handler
  const handleSearch = async () => {
    setSearching(true);
    setShowExamples(false);
    
    if (aiMode) {
      // AI Mode: Call Agent API
      try {
        const threadId = generateThreadId();
        
        const response = await fetch(AI_AGENT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: AI_AGENT_ID,
            message: JSON.stringify({
              query: query,
              portfolio: locations,
              selected_location_id: selected?.location_id || null,
              current_filters: {}
            }),
            thread_id: threadId
          })
        });
        
        if (!response.ok) {
          throw new Error(`Agent API error: ${response.status}`);
        }
        
        const agentResponse = await response.json();
        const processed = processAgentResponse(agentResponse, locations);
        
        // Apply results
        setFiltered(processed.filteredLocations);
        setActiveFilters([]); // AI mode doesn't use filter pills
        setInterpretation(processed.interpretation);
        
        // Select location if specified
        if (processed.selectedLocation) {
          setSelected(processed.selectedLocation);
          setViewMode('street');
        }
        
        // Zoom to bounds or filtered locations
        if (processed.mapBounds && map.current) {
          const { north, south, east, west } = processed.mapBounds;
          // Add padding to single-point bounds
          const latPadding = north === south ? 0.05 : 0;
          const lngPadding = east === west ? 0.05 : 0;
          map.current.fitBounds(
            [[west - lngPadding, south - latPadding], [east + lngPadding, north + latPadding]],
            { padding: 100, duration: 1500, maxZoom: 14 }
          );
        } else {
          setTimeout(() => zoomToLocations(processed.filteredLocations), 100);
        }
        
      } catch (error) {
        console.error('AI Agent error:', error);
        // Fallback to keyword search on error
        const result = parseQuery(query, locations);
        result.interpretation = `⚠️ AI unavailable, using keyword search: ${result.interpretation}`;
        setFiltered(result.locations);
        setActiveFilters(result.filters);
        setInterpretation(result.interpretation);
        setTimeout(() => zoomToLocations(result.locations), 100);
      }
    } else {
      // Standard Mode: Fast keyword search
      await new Promise(r => setTimeout(r, 300));
      
      const result = parseQuery(query, locations);
      
      setFiltered(result.locations);
      setActiveFilters(result.filters);
      setInterpretation(result.interpretation);
      setTimeout(() => zoomToLocations(result.locations), 100);
    }
    
    setSearching(false);
  };

  // Remove a specific filter
  const removeFilter = (filterId: string) => {
    const newFilters = activeFilters.filter(f => f.id !== filterId);
    if (newFilters.length === 0) {
      setFiltered(locations);
      setActiveFilters([]);
      setInterpretation('');
      setQuery('');
      zoomToLocations(locations);
    } else {
      // Re-run search without the removed filter terms
      // For simplicity, just clear all and let user re-search
      setFiltered(locations);
      setActiveFilters([]);
      setInterpretation('');
      setQuery('');
      zoomToLocations(locations);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFiltered(locations);
    setActiveFilters([]);
    setInterpretation('');
    setQuery('');
    map.current?.flyTo({ center: [-98, 39], zoom: 4, duration: 1500 });
  };

  // Handle example click
  const handleExampleClick = (example: string) => {
    setQuery(example);
    setShowExamples(false);
    setTimeout(() => {
      const result = parseQuery(example, locations);
      setFiltered(result.locations);
      setActiveFilters(result.filters);
      setInterpretation(result.interpretation);
      setTimeout(() => zoomToLocations(result.locations), 100);
    }, 100);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setShowUserMenu(false);
      if (!(e.target as HTMLElement).closest('.search-container')) {
        setShowExamples(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Get Google Maps embed URL
  const getMapUrl = (loc: Location) => {
    if (viewMode === 'street') {
      return `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${loc.lat},${loc.lon}&fov=90`;
    }
    return `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_KEY}&center=${loc.lat},${loc.lon}&zoom=19&maptype=satellite`;
  };

  const kpis = [
    { label: 'Locations', value: stats.count.toString(), color: '#60a5fa' },
    { label: 'Total TIV', value: formatCurrency(stats.tiv), color: '#34d399' },
    { label: 'Avg TIV', value: formatCurrency(stats.tiv / (stats.count || 1)), color: '#22d3ee' },
    { label: 'Claims', value: `${stats.claims}`, sub: formatCurrency(stats.incurred), color: '#fb923c' },
    { label: 'Alerts', value: stats.alerts.toString(), color: stats.alerts > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' },
  ];

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: 'white', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflow: 'hidden' }}>
      
      {/* Header */}
      <header style={{ height: 60, background: 'linear-gradient(180deg, #0f0f14 0%, #0a0a0f 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0 }}>
        
        {/* Left - Logo */}
        <div style={{ flex: '0 0 200px', display: 'flex', alignItems: 'center' }}>
          <img 
            src="/elevatenowlogo.png" 
            alt="ElevateNow" 
            style={{ height: 36, width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
        
        {/* Center - Smart Search */}
        <div className="search-container" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              ref={searchInputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              onFocus={() => setShowExamples(true)}
              placeholder={aiMode ? 'Ask AI anything about your portfolio...' : EXAMPLE_QUERIES[placeholderIndex]}
              style={{ 
                width: '100%', 
                background: aiMode ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.06)', 
                border: aiMode ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.1)', 
                borderRadius: 12, 
                padding: '12px 160px 12px 44px', 
                fontSize: 14, 
                color: 'white', 
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: aiMode ? '0 0 20px rgba(139,92,246,0.15)' : 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.5 }}>🔍</span>
            
            {query && (
              <button
                onClick={() => { setQuery(''); clearAllFilters(); }}
                style={{ 
                  position: 'absolute', 
                  right: 130, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'rgba(255,255,255,0.4)', 
                  fontSize: 18, 
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ×
              </button>
            )}
            
            {/* Magic Wand Toggle */}
            <button
              onClick={() => setAiMode(!aiMode)}
              title={aiMode ? 'AI Mode ON - Click to disable' : 'Enable AI-powered search'}
              style={{ 
                position: 'absolute', 
                right: 95, 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: aiMode ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'transparent',
                border: aiMode ? 'none' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                width: 36,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: aiMode ? '0 0 12px rgba(139,92,246,0.5)' : 'none',
              }}
            >
              <span style={{ fontSize: 16, filter: aiMode ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' : 'none' }}>🪄</span>
            </button>
            
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{ 
                position: 'absolute', 
                right: 6, 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: searching 
                  ? 'rgba(59,130,246,0.5)' 
                  : aiMode 
                    ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' 
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 8, 
                padding: '8px 16px', 
                fontSize: 13, 
                fontWeight: 500, 
                cursor: searching ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: aiMode ? '0 0 12px rgba(139,92,246,0.4)' : 'none',
              }}
            >
              {searching ? (
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              ) : aiMode ? (
                <>✨ Ask AI</>
              ) : (
                <>Search</>
              )}
            </button>

            {/* Example queries dropdown */}
            {showExamples && !query && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 8,
                background: '#1a1a1f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                zIndex: 1000,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Try asking...
                </div>
                {EXAMPLE_QUERIES.slice(0, 6).map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(example)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: 13,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
                  >
                    <span style={{ opacity: 0.4 }}>→</span>
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Right - User Profile */}
        <div style={{ flex: '0 0 200px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 10, 
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
                border: '2px solid rgba(255,255,255,0.1)', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
            
            {showUserMenu && (
              <div 
                style={{ 
                  position: 'absolute', 
                  top: 50, 
                  right: 0, 
                  width: 200, 
                  background: '#1a1a1f', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: 12, 
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  zIndex: 1000,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>VS</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Administrator</div>
                </div>
                <div style={{ padding: '8px' }}>
                  <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    ⚙️ Settings
                  </button>
                  <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: '#f87171', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    🚪 Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Feedback Bar - Collapsible for AI responses */}
      {(interpretation || activeFilters.length > 0) && (
        <div style={{ 
          background: interpretation.startsWith('🤖') ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)', 
          borderBottom: `1px solid ${interpretation.startsWith('🤖') ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}`,
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {/* Collapsed Header - Always visible */}
          <div 
            onClick={() => interpretation.startsWith('🤖') && setAiResponseExpanded(!aiResponseExpanded)}
            style={{ 
              height: 44, 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 24px', 
              gap: 12,
              cursor: interpretation.startsWith('🤖') ? 'pointer' : 'default',
            }}
          >
            {/* AI Response Toggle */}
            {interpretation.startsWith('🤖') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAiResponseExpanded(!aiResponseExpanded);
                }}
                style={{
                  background: 'rgba(139,92,246,0.2)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: '#a78bfa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ 
                  transform: aiResponseExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                  transition: 'transform 0.2s',
                  display: 'inline-block',
                }}>▶</span>
                AI Insight
              </button>
            )}
            
            {/* Summary text when collapsed (AI mode) or full text (keyword mode) */}
            <span style={{ 
              fontSize: 13, 
              color: 'rgba(255,255,255,0.7)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {interpretation.startsWith('🤖') 
                ? (aiResponseExpanded ? '' : interpretation.substring(0, 100) + (interpretation.length > 100 ? '...' : ''))
                : interpretation
              }
            </span>
          
            {/* Active filter pills */}
            <div style={{ display: 'flex', gap: 8 }}>
              {activeFilters.map(filter => (
                <span 
                  key={filter.id}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 6,
                    background: 'rgba(59,130,246,0.2)', 
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 6, 
                    padding: '4px 10px', 
                    fontSize: 12, 
                    color: '#60a5fa',
                  }}
                >
                  {filter.label}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFilter(filter.id);
                    }}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#60a5fa', 
                      cursor: 'pointer', 
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            {activeFilters.length > 0 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllFilters();
                }}
                style={{ 
                  background: 'transparent', 
                  border: '1px solid rgba(255,255,255,0.2)', 
                  borderRadius: 6, 
                  padding: '4px 12px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)', 
                  cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            )}

            {/* Close button for AI responses */}
            {interpretation.startsWith('🤖') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInterpretation('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 16,
                }}
              >
                ×
              </button>
            )}
          </div>
          
          {/* Expanded AI Response Content */}
          {interpretation.startsWith('🤖') && aiResponseExpanded && (
            <div style={{
              padding: '0 24px 16px 24px',
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.85)',
              }}>
                {interpretation.substring(2).trim()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ height: 84, background: '#0c0c10', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', padding: '0 24px', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {kpis.map(kpi => (
          <div 
            key={kpi.label} 
            style={{ 
              flex: 1,
              background: hoveredKpi === kpi.label ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${hoveredKpi === kpi.label ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 14,
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={() => setHoveredKpi(kpi.label)}
            onMouseLeave={() => setHoveredKpi(null)}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</span>
              {kpi.sub && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{kpi.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          
          {/* Legend */}
          <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(20,20,25,0.92)', backdropFilter: 'blur(16px)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>TIV Range</div>
            {[
              { c: '#3b82f6', l: '< $500K' },
              { c: '#22c55e', l: '$500K - $2M' },
              { c: '#eab308', l: '$2M - $10M' },
              { c: '#f97316', l: '$10M - $50M' },
              { c: '#ef4444', l: '> $50M' },
            ].map(i => (
              <div key={i.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: i.c, boxShadow: `0 0 8px ${i.c}40` }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{i.l}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24', border: '2px solid #fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Has Alert</span>
              </div>
            </div>
            
            {/* Active Overlay Legend */}
            {activeOverlays.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Active Layers</div>
                {activeOverlays.map(overlayId => {
                  const config = PERIL_OVERLAYS[overlayId];
                  return (
                    <div key={overlayId} style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12 }}>{config.icon}</span>
                        <span style={{ fontSize: 11, color: config.color, fontWeight: 600 }}>{config.name}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 18 }}>
                        {config.legendItems.slice(0, 3).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Peril Layer Controls */}
          <div style={{ 
            position: 'absolute', 
            top: 20, 
            left: 24, 
            background: 'rgba(20,20,25,0.92)', 
            backdropFilter: 'blur(16px)', 
            borderRadius: 12, 
            padding: '12px 14px', 
            border: '1px solid rgba(255,255,255,0.08)', 
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)', 
            zIndex: 10,
            display: 'flex',
            gap: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', marginRight: 4 }}>
              Layers
            </div>
            {Object.entries(PERIL_OVERLAYS).map(([key, config]) => {
              const isActive = activeOverlays.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleOverlay(key)}
                  title={config.name}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isActive ? `${config.color}25` : 'rgba(255,255,255,0.05)',
                    border: isActive ? `2px solid ${config.color}` : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? `0 0 12px ${config.color}40` : 'none',
                  }}
                >
                  {config.icon}
                </button>
              );
            })}
          </div>
          
          {/* Count badge */}
          <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(20,20,25,0.92)', backdropFilter: 'blur(16px)', borderRadius: 12, padding: '12px 20px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{filtered.length}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>
              {filtered.length === locations.length ? 'locations' : `of ${locations.length}`}
            </span>
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{ width: 460, background: '#0e0e12', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Map View Header */}
            <div style={{ height: 260, position: 'relative', background: '#18181b', flexShrink: 0 }}>
              <iframe
                key={`${selected.location_id}-${viewMode}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                src={getMapUrl(selected)}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              
              {/* View Toggle Buttons */}
              <div style={{ position: 'absolute', bottom: 80, right: 14, display: 'flex', gap: 6, zIndex: 10 }}>
                <button
                  onClick={() => setViewMode('satellite')}
                  style={{ 
                    padding: '6px 12px', 
                    background: viewMode === 'satellite' ? '#3b82f6' : 'rgba(0,0,0,0.7)', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: 6, 
                    color: 'white', 
                    fontSize: 11, 
                    fontWeight: 500,
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Satellite
                </button>
                <button
                  onClick={() => setViewMode('street')}
                  style={{ 
                    padding: '6px 12px', 
                    background: viewMode === 'street' ? '#3b82f6' : 'rgba(0,0,0,0.7)', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: 6, 
                    color: 'white', 
                    fontSize: 11, 
                    fontWeight: 500,
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Street
                </button>
              </div>
              
              {/* Close button */}
              <button
                onClick={() => setSelected(null)}
                style={{ 
                  position: 'absolute', 
                  top: 14, 
                  right: 14, 
                  width: 36, 
                  height: 36, 
                  background: 'rgba(0,0,0,0.7)', 
                  backdropFilter: 'blur(8px)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: 10, 
                  color: 'white', 
                  fontSize: 20, 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  zIndex: 10,
                }}
              >×</button>
              
              {/* Address overlay */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, #0e0e12)', padding: '48px 20px 16px', zIndex: 5 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{selected.address}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{selected.city}, {selected.state} {selected.zip}</div>
              </div>
            </div>
            
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total TIV</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#34d399', marginTop: 6 }}>{formatCurrency(selected.total_tiv)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year Built</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{selected.year_built}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Construction</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{selected.construction_code}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protection</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: selected.sprinkler_status === 'Fully Sprinklered' ? '#22c55e' : '#eab308' }}>
                    {selected.sprinkler_status === 'Fully Sprinklered' ? 'Sprinklered' : 'Partial/None'}
                  </div>
                </div>
              </div>
              
              {/* CAT Hazards */}
              <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 18, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>CAT Hazards</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { l: 'Hurricane', v: selected.hurricane },
                    { l: 'Earthquake', v: selected.earthquake },
                    { l: 'Tornado', v: selected.tornado_hail },
                    { l: 'Surge', v: selected.surge_risk },
                    { l: 'Wildfire', v: selected.wildfire },
                    { l: 'Flood', v: selected.flood_score },
                  ].map(h => (
                    <div key={h.l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{h.l}</div>
                      <div style={{ marginTop: 6, background: `${getRiskColor(h.v)}18`, borderRadius: 8, padding: '8px 0' }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(h.v) }}>{h.v}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Claims */}
              <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 18, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Claims History</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{selected.total_claims}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Total Claims</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#fb923c' }}>{formatCurrency(selected.total_incurred)}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Incurred</div>
                  </div>
                </div>
              </div>
              
              {/* Risk Alert */}
              {selected.has_recommendations === 'Y' && (
                <div style={{ marginTop: 20, background: 'rgba(251,191,36,0.08)', borderRadius: 14, padding: 18, border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ width: 36, height: 36, background: 'rgba(251,191,36,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>⚠️</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24' }}>{selected.rc_title}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 1.6 }}>{selected.rc_text}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}