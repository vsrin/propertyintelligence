// App.tsx - Property Risk Analytics Dashboard (Enhanced with MDM Features)
// Account-centric view, data quality indicators, and Customer 360 panel

import { useEffect, useState, useRef, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import portfolioData from './data/portfolio.json';

// Modular imports
import type { Location, ActiveFilter, Account, ViewMode } from './types';
import { GRADE_COLORS, DATA_QUALITY_LABELS } from './types';
import { MAPBOX_TOKEN, GOOGLE_MAPS_KEY, AI_AGENT_URL, AI_AGENT_ID, EXAMPLE_QUERIES, PERIL_OVERLAYS } from './config';
import { formatCurrency, getMarkerColor, getRiskColor, generateThreadId, parseQuery, processAgentResponse } from './utils';

// Initialize Mapbox
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// Helper to get grade color
const getGradeColor = (grade: string): string => GRADE_COLORS[grade] || '#6b7280';

export default function App() {
  // State
  const [locations] = useState<Location[]>(portfolioData as Location[]);
  const [filtered, setFiltered] = useState<Location[]>(portfolioData as Location[]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredKpi, setHoveredKpi] = useState<string | null>(null);
  const [streetViewMode, setStreetViewMode] = useState<'street' | 'satellite'>('street');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [interpretation, setInterpretation] = useState<string>('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showExamples, setShowExamples] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiResponseExpanded, setAiResponseExpanded] = useState(true);
  const [activeOverlays, setActiveOverlays] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('locations');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'hazards' | 'data' | 'summary' | 'engineering' | 'cat' | 'claims' | 'account' | 'submissions' | 'mdm'>('overview');
  const [expandedDetailView, setExpandedDetailView] = useState(false);
  const [showMDMDropdown, setShowMDMDropdown] = useState(false);
  
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derived: unique accounts from locations
  const accounts = useMemo(() => {
    const accountMap = new Map<string, Account & { locations: Location[], totalTIV: number }>();
    locations.forEach(loc => {
      if (!accountMap.has(loc.account_id)) {
        accountMap.set(loc.account_id, {
          account_id: loc.account_id,
          account_name: loc.account_name,
          account_type: loc.occupancy_desc?.includes('College') ? 'university' : 
                        loc.occupancy_desc?.includes('Hospital') ? 'healthcare' : 'commercial',
          hq_city: loc.city,
          hq_state: loc.state,
          hq_lat: loc.lat,
          hq_lon: loc.lon,
          region: loc.region || 'Unknown',
          naics: loc.naics_code || '',
          sic: loc.sic_code || '',
          annual_revenue: 0,
          employees: 0,
          years_in_business: 0,
          broker_name: '',
          broker_city: '',
          broker_state: '',
          existing_carriers: [],
          num_locations: 0,
          locations: [],
          totalTIV: 0,
        });
      }
      const acc = accountMap.get(loc.account_id)!;
      acc.locations.push(loc);
      acc.totalTIV += loc.total_tiv;
      acc.num_locations = acc.locations.length;
    });
    return Array.from(accountMap.values());
  }, [locations]);

  // Selected account's locations
  const accountLocations = useMemo(() => {
    if (!selectedAccountId) return [];
    return locations.filter(l => l.account_id === selectedAccountId);
  }, [locations, selectedAccountId]);

  // Locations to display on map - account locations when account selected, otherwise filtered
  const displayLocations = useMemo(() => {
    if (viewMode === 'accounts' && selectedAccountId) {
      return accountLocations;
    }
    return filtered;
  }, [viewMode, selectedAccountId, accountLocations, filtered]);

  // Computed stats
  const stats = useMemo(() => {
    const locs = displayLocations;
    const uniqueAccounts = new Set(locs.map(l => l.account_id)).size;
    const dataQualityIssues = locs.filter(l => l.data_quality_issues?.length > 0).length;
    const duplicatesCount = locs.reduce((s, l) => s + (l.potential_duplicates?.length || 0), 0);
    const conflictsCount = locs.reduce((s, l) => s + (l.data_conflicts?.length || 0), 0);
    const enrichmentCount = locs.reduce((s, l) => s + (l.enrichment_opportunities?.length || 0), 0);
    const totalTIV = locs.reduce((s, l) => s + l.total_tiv, 0);
    
    return {
      count: locs.length,
      accounts: uniqueAccounts,
      tiv: totalTIV,
      avgTIV: locs.length > 0 ? totalTIV / locs.length : 0,
      claims: locs.reduce((s, l) => s + l.total_claims, 0),
      incurred: locs.reduce((s, l) => s + l.total_incurred, 0),
      alerts: locs.filter(l => l.has_recommendations === 'Y').length,
      dataIssues: dataQualityIssues,
      dataQualityPct: locs.length > 0 ? Math.round((1 - dataQualityIssues / locs.length) * 100) : 100,
      duplicates: duplicatesCount,
      conflicts: conflictsCount,
      enrichment: enrichmentCount,
      // COPE metrics
      avgYearBuilt: locs.length > 0 ? Math.round(locs.reduce((s, l) => s + (l.year_built || 0), 0) / locs.length) : 0,
      sprinklered: locs.filter(l => l.sprinkler_status === 'Fully Sprinklered').length,
      sprinkleredPct: locs.length > 0 ? Math.round(locs.filter(l => l.sprinkler_status === 'Fully Sprinklered').length / locs.length * 100) : 0,
      // Construction breakdown
      frameCount: locs.filter(l => l.construction_code?.includes('Frame')).length,
      masonryCount: locs.filter(l => l.construction_code?.includes('Masonry')).length,
      fireResistiveCount: locs.filter(l => l.construction_code?.includes('Fire')).length,
      // Risk metrics
      highHurricane: locs.filter(l => l.hurricane === 'D' || l.hurricane === 'F').length,
      highEarthquake: locs.filter(l => l.earthquake === 'D' || l.earthquake === 'F').length,
      highFlood: locs.filter(l => l.flood_score === 'D' || l.flood_score === 'F').length,
      highWildfire: locs.filter(l => l.wildfire === 'D' || l.wildfire === 'F').length,
    };
  }, [displayLocations]);

  // Available KPI definitions
  const ALL_KPIS: Record<string, { label: string; getValue: () => string; getSub?: () => string; getColor: () => string; category: string }> = {
    accounts: { label: 'Accounts', getValue: () => stats.accounts.toString(), getColor: () => '#a78bfa', category: 'Portfolio' },
    locations: { label: 'Locations', getValue: () => stats.count.toString(), getColor: () => '#60a5fa', category: 'Portfolio' },
    totalTIV: { label: 'Total TIV', getValue: () => formatCurrency(stats.tiv), getColor: () => '#34d399', category: 'Portfolio' },
    avgTIV: { label: 'Avg TIV', getValue: () => formatCurrency(stats.avgTIV), getColor: () => '#22d3ee', category: 'Portfolio' },
    claims: { label: 'Claims', getValue: () => stats.claims.toString(), getSub: () => formatCurrency(stats.incurred), getColor: () => '#fb923c', category: 'Claims' },
    incurred: { label: 'Incurred', getValue: () => formatCurrency(stats.incurred), getColor: () => '#fb923c', category: 'Claims' },
    alerts: { label: 'Risk Alerts', getValue: () => stats.alerts.toString(), getSub: () => 'recommendations', getColor: () => stats.alerts > 0 ? '#fbbf24' : '#22c55e', category: 'Risk' },
    duplicates: { label: 'Duplicates', getValue: () => stats.duplicates.toString(), getSub: () => 'to review', getColor: () => stats.duplicates > 0 ? '#ef4444' : '#22c55e', category: 'Data Quality' },
    conflicts: { label: 'Conflicts', getValue: () => stats.conflicts.toString(), getSub: () => 'to resolve', getColor: () => stats.conflicts > 0 ? '#eab308' : '#22c55e', category: 'Data Quality' },
    enrichment: { label: 'Enrichment', getValue: () => stats.enrichment.toString(), getSub: () => 'opportunities', getColor: () => '#8b5cf6', category: 'Data Quality' },
    dataQuality: { label: 'Data Quality', getValue: () => `${stats.dataQualityPct}%`, getColor: () => stats.dataQualityPct >= 80 ? '#22c55e' : stats.dataQualityPct >= 60 ? '#eab308' : '#ef4444', category: 'Data Quality' },
    sprinklered: { label: 'Sprinklered', getValue: () => `${stats.sprinkleredPct}%`, getSub: () => `${stats.sprinklered} locations`, getColor: () => stats.sprinkleredPct >= 70 ? '#22c55e' : '#eab308', category: 'COPE' },
    avgYearBuilt: { label: 'Avg Year Built', getValue: () => stats.avgYearBuilt.toString(), getColor: () => '#94a3b8', category: 'COPE' },
    frameConst: { label: 'Frame', getValue: () => stats.frameCount.toString(), getSub: () => 'locations', getColor: () => '#f97316', category: 'COPE' },
    masonryConst: { label: 'Masonry', getValue: () => stats.masonryCount.toString(), getSub: () => 'locations', getColor: () => '#64748b', category: 'COPE' },
    highHurricane: { label: 'Hurricane Risk', getValue: () => stats.highHurricane.toString(), getSub: () => 'high exposure', getColor: () => stats.highHurricane > 0 ? '#ef4444' : '#22c55e', category: 'CAT Exposure' },
    highEarthquake: { label: 'Earthquake Risk', getValue: () => stats.highEarthquake.toString(), getSub: () => 'high exposure', getColor: () => stats.highEarthquake > 0 ? '#ef4444' : '#22c55e', category: 'CAT Exposure' },
    highFlood: { label: 'Flood Risk', getValue: () => stats.highFlood.toString(), getSub: () => 'high exposure', getColor: () => stats.highFlood > 0 ? '#ef4444' : '#22c55e', category: 'CAT Exposure' },
    highWildfire: { label: 'Wildfire Risk', getValue: () => stats.highWildfire.toString(), getSub: () => 'high exposure', getColor: () => stats.highWildfire > 0 ? '#ef4444' : '#22c55e', category: 'CAT Exposure' },
  };

  // State for selected KPIs (default set - includes MDM metrics for demo)
  const [selectedKPIs, setSelectedKPIs] = useState<string[]>(['locations', 'totalTIV', 'duplicates', 'conflicts', 'alerts']);
  const [showKPIConfig, setShowKPIConfig] = useState(false);

  // Build KPIs from selected
  const kpis = selectedKPIs.map(id => {
    const kpi = ALL_KPIS[id];
    if (!kpi) return null;
    return {
      id,
      label: kpi.label,
      value: kpi.getValue(),
      sub: kpi.getSub?.(),
      color: kpi.getColor(),
    };
  }).filter(Boolean) as { id: string; label: string; value: string; sub?: string; color: string }[];

  // ============================================================================
  // Effects
  // ============================================================================

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

  // Handle peril overlay toggling
  useEffect(() => {
    if (!map.current || !mapReady) return;

    Object.entries(PERIL_OVERLAYS).forEach(([key, config]) => {
      const sourceId = `${key}-source`;
      const layerId = `${key}-layer`;
      const isActive = activeOverlays.includes(key);
      const sourceExists = map.current!.getSource(sourceId);

      if (isActive && !sourceExists) {
        const tileUrl = config.tiles[0];
        
        map.current!.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          scheme: 'xyz'
        });

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

  // Update markers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    markers.current.forEach(m => m.remove());
    markers.current = [];

    displayLocations.forEach((loc) => {
      const el = document.createElement('div');
      const color = getMarkerColor(loc.total_tiv);
      const hasAlert = loc.has_recommendations === 'Y';
      
      el.style.width = hasAlert ? '16px' : '14px';
      el.style.height = hasAlert ? '16px' : '14px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.border = hasAlert ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.8)';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      
      el.onclick = (e) => { 
        e.stopPropagation(); 
        setSelected(loc); 
        setStreetViewMode('street'); 
        setDetailTab('overview'); 
      };

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([loc.lon, loc.lat])
        .addTo(map.current!);
      
      markers.current.push(marker);
    });
  }, [displayLocations, mapReady]);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setShowUserMenu(false);
      setShowMDMDropdown(false);
      if (!(e.target as HTMLElement).closest('.search-container')) {
        setShowExamples(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ============================================================================
  // Handlers
  // ============================================================================

  const toggleOverlay = (overlayId: string) => {
    setActiveOverlays(prev => 
      prev.includes(overlayId) ? prev.filter(id => id !== overlayId) : [...prev, overlayId]
    );
  };

  const zoomToLocations = (locs: Location[]) => {
    if (!map.current || locs.length === 0) return;

    if (locs.length === 1) {
      map.current.flyTo({ center: [locs[0].lon, locs[0].lat], zoom: 14, duration: 1500 });
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

  const handleSearch = async () => {
    setSearching(true);
    setShowExamples(false);
    
    if (aiMode) {
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
        
        if (!response.ok) throw new Error(`Agent API error: ${response.status}`);
        
        const agentResponse = await response.json();
        const processed = processAgentResponse(agentResponse, locations);
        
        setFiltered(processed.filteredLocations);
        setActiveFilters([]);
        setInterpretation(processed.interpretation);
        
        if (processed.selectedLocation) {
          setSelected(processed.selectedLocation);
          setStreetViewMode('street');
        }
        
        if (processed.mapBounds && map.current) {
          const { north, south, east, west } = processed.mapBounds;
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
        const result = parseQuery(query, locations);
        result.interpretation = `⚠️ AI unavailable, using keyword search: ${result.interpretation}`;
        setFiltered(result.locations);
        setActiveFilters(result.filters);
        setInterpretation(result.interpretation);
        setTimeout(() => zoomToLocations(result.locations), 100);
      }
    } else {
      await new Promise(r => setTimeout(r, 300));
      const result = parseQuery(query, locations);
      setFiltered(result.locations);
      setActiveFilters(result.filters);
      setInterpretation(result.interpretation);
      setTimeout(() => zoomToLocations(result.locations), 100);
    }
    
    setSearching(false);
  };

  const removeFilter = (filterId: string) => {
    setFiltered(locations);
    setActiveFilters([]);
    setInterpretation('');
    setQuery('');
    zoomToLocations(locations);
  };

  const clearAllFilters = () => {
    setFiltered(locations);
    setActiveFilters([]);
    setInterpretation('');
    setQuery('');
    setSelectedAccountId(null);
    setShowAccountPanel(false);
    map.current?.flyTo({ center: [-98, 39], zoom: 4, duration: 1500 });
  };

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

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setShowAccountPanel(true);
    setSelected(null);
    const accLocs = locations.filter(l => l.account_id === accountId);
    setTimeout(() => zoomToLocations(accLocs), 100);
  };

  const getMapUrl = (loc: Location) => {
    if (streetViewMode === 'street') {
      return `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${loc.lat},${loc.lon}&fov=90&source=outdoor`;
    }
    return `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_KEY}&center=${loc.lat},${loc.lon}&zoom=19&maptype=satellite`;
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderGradeBadge = (grade: string, label: string) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</div>
      <div style={{ 
        width: 32, height: 32, borderRadius: 8,
        background: `${getGradeColor(grade)}20`,
        border: `1px solid ${getGradeColor(grade)}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: getGradeColor(grade),
        margin: '0 auto'
      }}>
        {grade}
      </div>
    </div>
  );

  const renderDataQualityBadge = (loc: Location) => {
    const score = loc.data_quality_score || 100;
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ 
          width: 8, height: 8, borderRadius: '50%', 
          background: color, boxShadow: `0 0 6px ${color}` 
        }} />
        <span style={{ fontSize: 12, color }}>{score}%</span>
      </div>
    );
  };

  const renderAvailableData = (loc: Location) => {
    const data = loc.available_data || {};
    const items = [
      { label: 'ISO Reports', count: data.iso_reports || 0, icon: '📋' },
      { label: 'RC Reports', count: data.risk_control_reports || 0, icon: '🔍' },
      { label: 'Claims', count: data.claims_count || 0, icon: '📁' },
      { label: 'Inspections', count: data.inspection_count || 0, icon: '🏗️' },
    ];
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {items.map(item => (
          <div key={item.label} style={{ 
            display: 'flex', alignItems: 'center', gap: 8,
            background: item.count > 0 ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${item.count > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 8, padding: '8px 10px'
          }}>
            <span>{item.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: item.count > 0 ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
                {item.count}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{item.label}</div>
            </div>
          </div>
        ))}
        {data.nearmap_available && (
          <div style={{ 
            gridColumn: 'span 2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 8, padding: '8px 10px', cursor: 'pointer'
          }}>
            <span>🛰️</span>
            <span style={{ fontSize: 12, color: '#22c55e' }}>Nearmap Imagery Available</span>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: 'white', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflow: 'hidden' }}>
      
      {/* Header */}
      <header style={{ height: 60, background: 'linear-gradient(180deg, #0f0f14 0%, #0a0a0f 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0 }}>
        
        {/* Logo */}
        <div style={{ flex: '0 0 200px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/elevatenowlogo.png" alt="ElevateNow" style={{ height: 36, width: 'auto', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        
        {/* View Mode Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3, marginRight: 16 }}>
          <button
            onClick={() => { setViewMode('locations'); setSelectedAccountId(null); setShowAccountPanel(false); }}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: viewMode === 'locations' ? 'rgba(59,130,246,0.3)' : 'transparent',
              color: viewMode === 'locations' ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            📍 Locations
          </button>
          <button
            onClick={() => setViewMode('accounts')}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: viewMode === 'accounts' ? 'rgba(167,139,250,0.3)' : 'transparent',
              color: viewMode === 'accounts' ? '#a78bfa' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            🏢 Accounts
          </button>
        </div>
        
        {/* Search */}
        <div className="search-container" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: 600, margin: '0 auto', position: 'relative' }}>
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
              <button onClick={() => { setQuery(''); clearAllFilters(); }} style={{ position: 'absolute', right: 130, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>×</button>
            )}
            
            {/* AI Toggle */}
            <button
              onClick={() => setAiMode(!aiMode)}
              title={aiMode ? 'AI Mode ON' : 'Enable AI search'}
              style={{ 
                position: 'absolute', right: 95, top: '50%', transform: 'translateY(-50%)', 
                background: aiMode ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'transparent',
                border: aiMode ? 'none' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, width: 36, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: aiMode ? '0 0 12px rgba(139,92,246,0.5)' : 'none',
              }}
            >
              <span style={{ fontSize: 16, filter: aiMode ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' : 'none' }}>🪄</span>
            </button>
            
            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{ 
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', 
                background: searching ? 'rgba(59,130,246,0.5)' : aiMode ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', 
                fontSize: 13, fontWeight: 500, cursor: searching ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: aiMode ? '0 0 12px rgba(139,92,246,0.4)' : 'none',
              }}
            >
              {searching ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> : aiMode ? <>✨ Ask AI</> : <>Search</>}
            </button>

            {/* Examples Dropdown */}
            {showExamples && !query && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 1000, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Try asking...</div>
                {EXAMPLE_QUERIES.slice(0, 6).map((example, i) => (
                  <button key={i} onClick={() => handleExampleClick(example)} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }} onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}>
                    <span style={{ opacity: 0.4 }}>→</span>{example}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* User Menu and MDM Dropdown */}
        <div style={{ flex: '0 0 280px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {/* MDM Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMDMDropdown(!showMDMDropdown); }}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', 
                background: activeFilters.some(f => f.id?.startsWith('mdm-')) ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: activeFilters.some(f => f.id?.startsWith('mdm-')) ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, 
                color: activeFilters.some(f => f.id?.startsWith('mdm-')) ? '#a78bfa' : 'rgba(255,255,255,0.7)',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer', 
                transition: 'all 0.15s',
              }}
            >
              <span>🔍</span>
              Data Quality
              <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
            </button>
            
            {showMDMDropdown && (
              <div style={{ 
                position: 'absolute', top: '100%', right: 0, marginTop: 8,
                width: 280, background: '#1a1a1f', 
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)', 
                overflow: 'hidden', zIndex: 1000 
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Filter by Data Quality Issue
                </div>
                
                {/* Duplicates */}
                <button
                  onClick={() => {
                    const locsWithDups = locations.filter(l => l.potential_duplicates && l.potential_duplicates.length > 0);
                    setFiltered(locsWithDups);
                    setActiveFilters([{ id: 'mdm-duplicates', label: `Duplicates (${locsWithDups.length})`, type: 'mdm' }]);
                    setInterpretation(`🔴 ${locsWithDups.length} locations with potential duplicates`);
                    setDetailTab('data');
                    setShowMDMDropdown(false);
                    setTimeout(() => zoomToLocations(locsWithDups), 100);
                  }}
                  style={{ 
                    width: '100%', padding: '12px 16px', 
                    background: activeFilters.some(f => f.id === 'mdm-duplicates') ? 'rgba(239,68,68,0.1)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.background = activeFilters.some(f => f.id === 'mdm-duplicates') ? 'rgba(239,68,68,0.1)' : 'transparent'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    Duplicate Locations
                  </span>
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                    {locations.filter(l => l.potential_duplicates && l.potential_duplicates.length > 0).length}
                  </span>
                </button>
                
                {/* Conflicts */}
                <button
                  onClick={() => {
                    const locsWithConflicts = locations.filter(l => l.data_conflicts && l.data_conflicts.length > 0);
                    setFiltered(locsWithConflicts);
                    setActiveFilters([{ id: 'mdm-conflicts', label: `Conflicts (${locsWithConflicts.length})`, type: 'mdm' }]);
                    setInterpretation(`⚠️ ${locsWithConflicts.length} locations with data conflicts`);
                    setDetailTab('data');
                    setShowMDMDropdown(false);
                    setTimeout(() => zoomToLocations(locsWithConflicts), 100);
                  }}
                  style={{ 
                    width: '100%', padding: '12px 16px', 
                    background: activeFilters.some(f => f.id === 'mdm-conflicts') ? 'rgba(234,179,8,0.1)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.background = activeFilters.some(f => f.id === 'mdm-conflicts') ? 'rgba(234,179,8,0.1)' : 'transparent'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308' }} />
                    Data Conflicts
                  </span>
                  <span style={{ fontSize: 12, color: '#eab308', fontWeight: 600 }}>
                    {locations.filter(l => l.data_conflicts && l.data_conflicts.length > 0).length}
                  </span>
                </button>
                
                {/* Enrichment */}
                <button
                  onClick={() => {
                    const locsWithEnrichment = locations.filter(l => l.enrichment_opportunities && l.enrichment_opportunities.length > 0);
                    setFiltered(locsWithEnrichment);
                    setActiveFilters([{ id: 'mdm-enrichment', label: `Enrichment (${locsWithEnrichment.length})`, type: 'mdm' }]);
                    setInterpretation(`✨ ${locsWithEnrichment.length} locations with enrichment opportunities`);
                    setDetailTab('data');
                    setShowMDMDropdown(false);
                    setTimeout(() => zoomToLocations(locsWithEnrichment), 100);
                  }}
                  style={{ 
                    width: '100%', padding: '12px 16px', 
                    background: activeFilters.some(f => f.id === 'mdm-enrichment') ? 'rgba(139,92,246,0.1)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => (e.target as HTMLElement).style.background = activeFilters.some(f => f.id === 'mdm-enrichment') ? 'rgba(139,92,246,0.1)' : 'transparent'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
                    Enrichment Opportunities
                  </span>
                  <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>
                    {locations.filter(l => l.enrichment_opportunities && l.enrichment_opportunities.length > 0).length}
                  </span>
                </button>
                
                {/* Clear filter option */}
                {activeFilters.some(f => f.id?.startsWith('mdm-')) && (
                  <button
                    onClick={() => {
                      clearAllFilters();
                      setShowMDMDropdown(false);
                    }}
                    style={{ 
                      width: '100%', padding: '12px 16px', 
                      background: 'transparent',
                      border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* User Menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }} style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: '2px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: 50, right: 0, width: 200, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>VS</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Administrator</div>
                </div>
                <div style={{ padding: '8px' }}>
                  <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.8)', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>⚙️ Settings</button>
                  <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: '#f87171', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>🚪 Log Out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Feedback Bar */}
      {(interpretation || activeFilters.length > 0 || selectedAccountId) && (
        <div style={{ background: selectedAccountId ? 'rgba(167,139,250,0.08)' : interpretation.startsWith('🤖') ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)', borderBottom: `1px solid ${selectedAccountId ? 'rgba(167,139,250,0.2)' : interpretation.startsWith('🤖') ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}`, flexShrink: 0, overflow: 'hidden' }}>
          <div onClick={() => interpretation.startsWith('🤖') && setAiResponseExpanded(!aiResponseExpanded)} style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, cursor: interpretation.startsWith('🤖') ? 'pointer' : 'default' }}>
            {selectedAccountId && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#a78bfa' }}>
                🏢 {accounts.find(a => a.account_id === selectedAccountId)?.account_name} ({accountLocations.length} locations)
                <button onClick={(e) => { e.stopPropagation(); setSelectedAccountId(null); setShowAccountPanel(false); }} style={{ background: 'transparent', border: 'none', color: '#a78bfa', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
            )}
            {interpretation.startsWith('🤖') && (
              <button onClick={(e) => { e.stopPropagation(); setAiResponseExpanded(!aiResponseExpanded); }} style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ transform: aiResponseExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>AI Insight
              </button>
            )}
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {interpretation.startsWith('🤖') ? (aiResponseExpanded ? '' : interpretation.substring(0, 100) + (interpretation.length > 100 ? '...' : '')) : interpretation}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {activeFilters.map(filter => (
                <span key={filter.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#60a5fa' }}>
                  {filter.label}
                  <button onClick={(e) => { e.stopPropagation(); removeFilter(filter.id); }} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            {(activeFilters.length > 0 || selectedAccountId) && (
              <button onClick={(e) => { e.stopPropagation(); clearAllFilters(); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Clear all</button>
            )}
            {interpretation.startsWith('🤖') && (
              <button onClick={(e) => { e.stopPropagation(); setInterpretation(''); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>×</button>
            )}
          </div>
          {interpretation.startsWith('🤖') && aiResponseExpanded && (
            <div style={{ padding: '0 24px 16px 24px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 16, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>{interpretation.substring(2).trim()}</div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ height: 84, background: '#0c0c10', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', padding: '0 24px', gap: 16, alignItems: 'center', flexShrink: 0, position: 'relative' }}>
        {kpis.map(kpi => (
          <div 
            key={kpi.id} 
            style={{ flex: 1, background: hoveredKpi === kpi.label ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hoveredKpi === kpi.label ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s' }} 
            onMouseEnter={() => setHoveredKpi(kpi.label)} 
            onMouseLeave={() => setHoveredKpi(null)}
            onClick={() => {
              // Handle KPI click to filter
              if (kpi.id === 'duplicates') {
                const locsWithDups = locations.filter(l => l.potential_duplicates && l.potential_duplicates.length > 0);
                setFiltered(locsWithDups);
                setActiveFilters([{ id: 'mdm-duplicates', label: `Duplicates (${locsWithDups.length})`, type: 'mdm' }]);
                setInterpretation(`🔴 ${locsWithDups.length} locations with potential duplicates - click on a location to see matches`);
                setDetailTab('data'); // Auto-switch to Data tab
                setTimeout(() => zoomToLocations(locsWithDups), 100);
              } else if (kpi.id === 'conflicts') {
                const locsWithConflicts = locations.filter(l => l.data_conflicts && l.data_conflicts.length > 0);
                setFiltered(locsWithConflicts);
                setActiveFilters([{ id: 'mdm-conflicts', label: `Conflicts (${locsWithConflicts.length})`, type: 'mdm' }]);
                setInterpretation(`⚠️ ${locsWithConflicts.length} locations with data conflicts - click on a location to see details`);
                setDetailTab('data'); // Auto-switch to Data tab
                setTimeout(() => zoomToLocations(locsWithConflicts), 100);
              } else if (kpi.id === 'enrichment') {
                const locsWithEnrichment = locations.filter(l => l.enrichment_opportunities && l.enrichment_opportunities.length > 0);
                setFiltered(locsWithEnrichment);
                setActiveFilters([{ id: 'mdm-enrichment', label: `Enrichment (${locsWithEnrichment.length})`, type: 'mdm' }]);
                setInterpretation(`✨ ${locsWithEnrichment.length} locations with enrichment opportunities`);
                setDetailTab('data'); // Auto-switch to Data tab
                setTimeout(() => zoomToLocations(locsWithEnrichment), 100);
              } else if (kpi.id === 'alerts') {
                const locsWithAlerts = locations.filter(l => l.has_recommendations === 'Y');
                setFiltered(locsWithAlerts);
                setActiveFilters([{ id: 'alerts', label: `Risk Alerts (${locsWithAlerts.length})`, type: 'risk' }]);
                setInterpretation(`⚠️ ${locsWithAlerts.length} locations with risk control recommendations`);
                setTimeout(() => zoomToLocations(locsWithAlerts), 100);
              }
            }}
            title={['duplicates', 'conflicts', 'enrichment', 'alerts'].includes(kpi.id) ? `Click to filter by ${kpi.label}` : kpi.label}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
              {['duplicates', 'conflicts', 'enrichment', 'alerts'].includes(kpi.id) && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 8 }}>🔍</span> click to filter
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</span>
              {kpi.sub && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{kpi.sub}</span>}
            </div>
          </div>
        ))}
        
        {/* KPI Config Button */}
        <button
          onClick={() => setShowKPIConfig(true)}
          style={{
            width: 52,
            height: 52,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 18,
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          title="Configure KPIs"
        >
          ⚙️
        </button>
      </div>

      {/* KPI Configuration Modal */}
      {showKPIConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowKPIConfig(false)}>
          <div style={{ width: 600, maxHeight: '80vh', background: '#1a1a1f', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>Configure Dashboard KPIs</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Select up to 6 metrics to display • Drag to reorder</div>
              </div>
              <button onClick={() => setShowKPIConfig(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: 8 }}>×</button>
            </div>
            
            <div style={{ padding: 24, maxHeight: 'calc(80vh - 140px)', overflow: 'auto' }}>
              {/* Selected KPIs */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Selected KPIs ({selectedKPIs.length}/6)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedKPIs.map((id, idx) => {
                    const kpi = ALL_KPIS[id];
                    if (!kpi) return null;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: 'move' }}>⋮⋮</span>
                        <span style={{ fontSize: 13, color: 'white' }}>{kpi.label}</span>
                        <button 
                          onClick={() => setSelectedKPIs(prev => prev.filter(k => k !== id))}
                          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                        >×</button>
                      </div>
                    );
                  })}
                  {selectedKPIs.length === 0 && (
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>No KPIs selected. Choose from below.</div>
                  )}
                </div>
              </div>
              
              {/* Available KPIs by Category */}
              {['Portfolio', 'Claims', 'Risk', 'Data Quality', 'COPE', 'CAT Exposure'].map(category => {
                const categoryKPIs = Object.entries(ALL_KPIS).filter(([_, kpi]) => kpi.category === category);
                if (categoryKPIs.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{category}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {categoryKPIs.map(([id, kpi]) => {
                        const isSelected = selectedKPIs.includes(id);
                        const isDisabled = !isSelected && selectedKPIs.length >= 6;
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedKPIs(prev => prev.filter(k => k !== id));
                              } else if (!isDisabled) {
                                setSelectedKPIs(prev => [...prev, id]);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                              borderRadius: 8,
                              padding: '10px 14px',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              opacity: isDisabled ? 0.4 : 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: kpi.getColor() }} />
                            <span style={{ fontSize: 13, color: isSelected ? 'white' : 'rgba(255,255,255,0.7)' }}>{kpi.label}</span>
                            {isSelected && <span style={{ fontSize: 12, color: '#6366f1' }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setSelectedKPIs(['locations', 'totalTIV', 'avgTIV', 'alerts', 'claims'])}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowKPIConfig(false)}
                style={{ padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Account List Panel (when in account view) */}
        {viewMode === 'accounts' && (
          <div style={{ 
            width: sidebarCollapsed ? 0 : 320, 
            background: '#0e0e12', 
            borderRight: sidebarCollapsed ? 'none' : '1px solid rgba(255,255,255,0.06)', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            transition: 'width 0.2s ease',
            position: 'relative'
          }}>
            {!sidebarCollapsed && (
              <>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Accounts</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{accounts.length} accounts • {locations.length} total locations</div>
                  </div>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    title="Collapse sidebar"
                  >
                    ◀
                  </button>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {accounts.sort((a, b) => b.totalTIV - a.totalTIV).map(acc => (
                    <div
                      key={acc.account_id}
                      onClick={() => handleAccountSelect(acc.account_id)}
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        background: selectedAccountId === acc.account_id ? 'rgba(167,139,250,0.1)' : 'transparent',
                        borderLeft: selectedAccountId === acc.account_id ? '3px solid #a78bfa' : '3px solid transparent',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { if (selectedAccountId !== acc.account_id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (selectedAccountId !== acc.account_id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {acc.account_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                            {acc.hq_city}, {acc.hq_state}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#34d399' }}>
                            {formatCurrency(acc.totalTIV)}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                            {acc.num_locations} locs
                          </div>
                        </div>
                      </div>
                      {/* Data quality indicator */}
                      {acc.locations.some(l => l.data_quality_issues?.length > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />
                          <span style={{ fontSize: 10, color: '#f97316' }}>
                            {acc.locations.filter(l => l.data_quality_issues?.length > 0).length} data quality issues
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Sidebar expand button (when collapsed) */}
        {viewMode === 'accounts' && sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{ 
              position: 'absolute', 
              left: 24, 
              top: '50%', 
              transform: 'translateY(-50%)',
              background: 'rgba(20,20,25,0.95)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: 8, 
              padding: '12px 8px', 
              cursor: 'pointer', 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: 14,
              zIndex: 15,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            title="Expand sidebar"
          >
            ▶
          </button>
        )}
        
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          
          {/* Legend */}
          <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(20,20,25,0.92)', backdropFilter: 'blur(16px)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 10, maxWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>TIV Range</div>
            {[{ c: '#3b82f6', l: '< $500K' }, { c: '#22c55e', l: '$500K - $2M' }, { c: '#eab308', l: '$2M - $10M' }, { c: '#f97316', l: '$10M - $50M' }, { c: '#ef4444', l: '> $50M' }].map(i => (
              <div key={i.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: i.c, boxShadow: `0 0 8px ${i.c}40` }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{i.l}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Indicators</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6b7280', border: '2px solid #fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Risk Alert</span>
              </div>
            </div>
          </div>

          {/* Peril Overlays - Compact floating icons */}
          <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
            {Object.entries(PERIL_OVERLAYS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => toggleOverlay(key)}
                title={config.name}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: activeOverlays.includes(key) ? `${config.color}30` : 'rgba(20,20,25,0.92)',
                  border: `1px solid ${activeOverlays.includes(key) ? config.color : 'rgba(255,255,255,0.1)'}`,
                  backdropFilter: 'blur(16px)',
                  boxShadow: activeOverlays.includes(key) ? `0 0 12px ${config.color}50` : '0 2px 8px rgba(0,0,0,0.3)',
                  cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                  transition: 'all 0.15s',
                }}
              >
                {config.icon}
              </button>
            ))}
          </div>
        </div>
        
        {/* Detail Panel */}
        {selected && (
          <div style={{ width: 460, background: '#0e0e12', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Street View */}
            <div style={{ height: 240, position: 'relative', background: '#18181b', flexShrink: 0 }}>
              <iframe key={`${selected.location_id}-${streetViewMode}`} style={{ width: '100%', height: '100%', border: 'none' }} src={getMapUrl(selected)} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <div style={{ position: 'absolute', bottom: 70, right: 14, display: 'flex', gap: 6, zIndex: 10 }}>
                <button onClick={() => setStreetViewMode('satellite')} style={{ padding: '6px 12px', background: streetViewMode === 'satellite' ? '#3b82f6' : 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>Satellite</button>
                <button onClick={() => setStreetViewMode('street')} style={{ padding: '6px 12px', background: streetViewMode === 'street' ? '#3b82f6' : 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>Street</button>
              </div>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
              <button onClick={() => { setExpandedDetailView(true); setDetailTab('summary'); }} title="Expand to full view" style={{ position: 'absolute', top: 14, right: 56, width: 36, height: 36, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>⛶</button>
              
              {/* Data Quality Badge */}
              <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 10 }}>
                {renderDataQualityBadge(selected)}
              </div>
              
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, #0e0e12)', padding: '48px 20px 16px', zIndex: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{selected.address}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{selected.city}, {selected.state} {selected.zip}</div>
                  </div>
                  {selected.building_name && (
                    <div style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: '#a78bfa' }}>
                      {selected.building_name}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                  {selected.account_name}
                </div>
              </div>
            </div>
            
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              {(['overview', 'hazards', 'data'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  style={{
                    flex: 1, padding: '12px', background: 'transparent', border: 'none',
                    borderBottom: detailTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                    color: detailTab === tab ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
                    transition: 'all 0.15s', position: 'relative'
                  }}
                >
                  {tab === 'overview' ? '📋 Overview' : tab === 'hazards' ? '⚠️ Hazards' : '📊 Data'}
                  {tab === 'data' && ((selected.potential_duplicates?.length > 0) || (selected.data_conflicts?.length > 0) || (selected.enrichment_opportunities?.length > 0)) && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      minWidth: 16, height: 16, borderRadius: 8,
                      background: selected.potential_duplicates?.length > 0 ? '#ef4444' : selected.data_conflicts?.length > 0 ? '#eab308' : '#8b5cf6',
                      color: 'white', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px'
                    }}>
                      {(selected.potential_duplicates?.length || 0) + (selected.data_conflicts?.length || 0) + (selected.enrichment_opportunities?.length || 0)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {detailTab === 'overview' && (
                <>
                  {/* Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total TIV</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399', marginTop: 4 }}>{formatCurrency(selected.total_tiv)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year Built</div>
                      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{selected.year_built}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Construction</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{selected.construction_type || selected.construction_code || 'Unknown'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protection</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: selected.sprinkler_status === 'Y' ? '#22c55e' : selected.sprinkler_status === 'Partial' ? '#eab308' : '#ef4444' }}>
                        {selected.sprinkler_status === 'Y' ? 'Sprinklered' : selected.sprinkler_status === 'Partial' ? 'Partial' : 'Not Sprinklered'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional Details */}
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Building Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {selected.sq_footage && (
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Sq Ft:</span> <span style={{ fontSize: 12 }}>{selected.sq_footage.toLocaleString()}</span></div>
                      )}
                      {selected.stories && (
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Stories:</span> <span style={{ fontSize: 12 }}>{selected.stories}</span></div>
                      )}
                      {selected.roof_type && (
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Roof:</span> <span style={{ fontSize: 12 }}>{selected.roof_type}</span></div>
                      )}
                      {selected.fire_protection_class && (
                        <div><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Protection Class:</span> <span style={{ fontSize: 12 }}>{selected.fire_protection_class}</span></div>
                      )}
                      {selected.occupancy_desc && (
                        <div style={{ gridColumn: 'span 2' }}><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Occupancy:</span> <span style={{ fontSize: 12 }}>{selected.occupancy_desc}</span></div>
                      )}
                    </div>
                  </div>
                  
                  {/* Claims */}
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Claims History</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{selected.total_claims}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Total Claims</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#fb923c' }}>{formatCurrency(selected.total_incurred)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Incurred</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Risk Alert */}
                  {selected.has_recommendations === 'Y' && (
                    <div style={{ marginTop: 16, background: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, border: '1px solid rgba(251,191,36,0.2)' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ width: 32, height: 32, background: 'rgba(251,191,36,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>⚠️</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>{selected.rc_title}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 1.5 }}>{selected.rc_text}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {detailTab === 'hazards' && (
                <>
                  {/* CAT Hazard Grades */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>CAT Hazard Grades</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      {renderGradeBadge(selected.hurricane_grade || 'B', 'Hurricane')}
                      {renderGradeBadge(selected.earthquake_grade || 'B', 'Earthquake')}
                      {renderGradeBadge(selected.tornado_grade || 'B', 'Tornado')}
                      {renderGradeBadge(selected.hail_grade || 'B', 'Hail')}
                      {renderGradeBadge(selected.flood_grade || 'B', 'Flood')}
                      {renderGradeBadge(selected.wildfire_grade || 'A', 'Wildfire')}
                      {renderGradeBadge(selected.wind_grade || 'B', 'Wind')}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Flood Zone</div>
                        <div style={{ 
                          padding: '6px 10px', borderRadius: 8,
                          background: selected.flood_zone === 'X' ? 'rgba(34,197,94,0.2)' : selected.flood_zone?.includes('V') ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                          fontSize: 12, fontWeight: 600, color: selected.flood_zone === 'X' ? '#22c55e' : selected.flood_zone?.includes('V') ? '#ef4444' : '#eab308'
                        }}>
                          {selected.flood_zone || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Numeric Scores */}
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Risk Scores (1-10)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      {[
                        { l: 'Hurricane', v: selected.hurricane },
                        { l: 'Earthquake', v: selected.earthquake },
                        { l: 'Tornado', v: selected.tornado_hail },
                        { l: 'Surge', v: selected.surge_risk },
                        { l: 'Wildfire', v: selected.wildfire },
                        { l: 'Flood', v: selected.flood_score }
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
                  
                  {/* Protection Details */}
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Protection Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selected.fire_hydrant_distance && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Fire Hydrant Distance</span>
                          <span>{selected.fire_hydrant_distance}</span>
                        </div>
                      )}
                      {selected.coast_distance && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Distance to Coast</span>
                          <span>{selected.coast_distance}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {detailTab === 'data' && (
                <>
                  {/* Potential Duplicates */}
                  {selected.potential_duplicates?.length > 0 && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 16, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          🔴 Potential Duplicates ({selected.potential_duplicates.length})
                        </div>
                        <button style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#ef4444', cursor: 'pointer' }}>
                          Review All
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {selected.potential_duplicates.map((dupe: any, idx: number) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, color: 'white' }}>{dupe.address}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: dupe.match_score > 80 ? '#ef4444' : dupe.match_score > 60 ? '#f97316' : '#eab308' }}>
                                {dupe.match_score}% match
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                              {dupe.match_reasons?.join(' • ')}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button style={{ flex: 1, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, padding: '4px 8px', fontSize: 10, color: '#22c55e', cursor: 'pointer' }}>
                                ✓ Merge
                              </button>
                              <button style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', fontSize: 10, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                ✗ Not Duplicate
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Conflicts */}
                  {selected.data_conflicts?.length > 0 && (
                    <div style={{ background: 'rgba(234,179,8,0.08)', borderRadius: 12, padding: 16, border: '1px solid rgba(234,179,8,0.2)', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          ⚠️ Data Conflicts ({selected.data_conflicts.length})
                        </div>
                        <button style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#eab308', cursor: 'pointer' }}>
                          Resolve All
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {selected.data_conflicts.map((conflict: any, idx: number) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'white', marginBottom: 6 }}>{conflict.field_label}</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                              <div style={{ flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: 8 }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{conflict.current_source}</div>
                                <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>{conflict.current_value}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.3)' }}>vs</div>
                              <div style={{ flex: 1, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: 8 }}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{conflict.conflicting_source}</div>
                                <div style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>{conflict.conflicting_value}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                              💡 {conflict.recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submission History */}
                  {selected.submission_history?.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                        📋 Submission History ({selected.submission_history.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selected.submission_history.map((sub: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: idx < selected.submission_history.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                            <div>
                              <div style={{ fontSize: 12, color: 'white' }}>{sub.source}</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{sub.broker} • {sub.date}</div>
                            </div>
                            <div style={{ fontSize: 11, color: '#34d399' }}>{formatCurrency(sub.tiv_at_submission)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Enrichment Opportunities */}
                  {selected.enrichment_opportunities?.length > 0 && (
                    <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 16, border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                        ✨ Enrichment Opportunities
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selected.enrichment_opportunities.map((enrich: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: 12, color: 'white' }}>{enrich.label}</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{enrich.action}</div>
                            </div>
                            <button style={{ 
                              background: enrich.available ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', 
                              border: `1px solid ${enrich.available ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.2)'}`, 
                              borderRadius: 4, padding: '4px 10px', fontSize: 10, 
                              color: enrich.available ? '#22c55e' : 'rgba(255,255,255,0.4)', 
                              cursor: enrich.available ? 'pointer' : 'not-allowed' 
                            }}>
                              {enrich.available ? 'Enrich Now' : 'Unavailable'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available Location Data */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Available Location Data</div>
                    {renderAvailableData(selected)}
                  </div>
                  
                  {/* Source & Metadata */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Source & Metadata</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Source System</span>
                        <span>{selected.source_system || 'Unknown'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Last Inspection</span>
                        <span style={{ color: selected.data_quality_issues?.includes('stale_inspection') ? '#f97316' : 'white' }}>
                          {selected.last_inspection_date || 'N/A'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Location ID</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.location_id}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Account ID</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.account_id}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expanded Location Detail View Modal */}
      {expandedDetailView && selected && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header with aerial image */}
          <div style={{ height: 280, position: 'relative', background: '#18181b', flexShrink: 0 }}>
            <iframe 
              style={{ width: '100%', height: '100%', border: 'none' }} 
              src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&center=${selected.lat},${selected.lon}&zoom=18&maptype=satellite`}
              allowFullScreen 
              loading="lazy" 
            />
            
            {/* Location info overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 24px', background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0 }}>{selected.address}</h1>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{selected.city}, {selected.state} {selected.zip}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{selected.county} • {selected.lat.toFixed(6)}, {selected.lon.toFixed(6)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {renderDataQualityBadge(selected)}
                  <button onClick={() => setExpandedDetailView(false)} style={{ width: 40, height: 40, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'white', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
            </div>
            
            {/* Street View button */}
            <button 
              onClick={() => window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selected.lat},${selected.lon}`, '_blank')}
              style={{ position: 'absolute', bottom: 16, left: 24, padding: '8px 16px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
              🚶 Street View
            </button>
          </div>
          
          {/* Navigation Tabs - styled like the reference */}
          <div style={{ display: 'flex', background: '#1a1a2e', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            {[
              { id: 'summary', label: 'Location Summary', icon: '📍' },
              { id: 'engineering', label: 'Engineering Reports', icon: '📋' },
              { id: 'cat', label: 'CAT Hazards', icon: '🌀' },
              { id: 'claims', label: 'Claim Information', icon: '📊' },
              { id: 'account', label: 'Account Info', icon: '🏢' },
              { id: 'submissions', label: 'Prior Submissions', icon: '📁' },
              { id: 'mdm', label: 'Data Quality', icon: '🔍' },
            ].map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as any)}
                style={{
                  flex: 1, padding: '14px 12px', background: detailTab === tab.id ? '#252540' : 'transparent',
                  border: 'none', borderBottom: detailTab === tab.id ? '3px solid #60a5fa' : '3px solid transparent',
                  color: detailTab === tab.id ? 'white' : 'rgba(255,255,255,0.6)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.03em',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                }}
              >
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Content Area */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#0e0e12' }}>
            {/* Location Summary Tab */}
            {detailTab === 'summary' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Building Details */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>🏗️ Building Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Occupancy</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.occupancy_desc || 'Not specified'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Square Footage</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.sq_footage?.toLocaleString() || 'N/A'} sq ft</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Year Built</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.year_built || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Stories</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.stories || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Construction Class</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.construction_type || 'Unknown'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Sprinkler Status</div>
                      <div style={{ fontSize: 14, color: selected.sprinkler_status === 'Y' ? '#22c55e' : selected.sprinkler_status === 'N' ? '#ef4444' : '#eab308' }}>
                        {selected.sprinkler_status === 'Y' ? '✓ Fully Sprinklered' : selected.sprinkler_status === 'N' ? '✗ Not Sprinklered' : 'Partial'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Protection Class</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.fire_protection_class || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Roof Type</div>
                      <div style={{ fontSize: 14, color: 'white' }}>{selected.roof_type || 'N/A'} - {selected.roof_shape || 'N/A'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Values */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>💰 Insured Values</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(52,211,153,0.1)', borderRadius: 8, border: '1px solid rgba(52,211,153,0.2)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Total Insured Value</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>{formatCurrency(selected.total_tiv)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Building</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{formatCurrency(selected.building_value)}</div>
                      </div>
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Contents</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{formatCurrency(selected.contents_value)}</div>
                      </div>
                      <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>BII</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{formatCurrency(selected.bii_value)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Risk Control */}
                {selected.has_recommendations === 'Y' && (
                  <div style={{ gridColumn: 'span 2', background: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 20, border: '1px solid rgba(251,191,36,0.2)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fbbf24', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ Risk Control Recommendation</h3>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{selected.rc_category}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 8 }}>{selected.rc_title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{selected.rc_text}</div>
                    {selected.rc_job_number && (
                      <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Job #: {selected.rc_job_number}</div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Engineering Reports Tab */}
            {detailTab === 'engineering' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[
                    { label: 'ISO Reports', count: selected.available_data?.iso_reports || 0, color: '#3b82f6' },
                    { label: 'Risk Control Reports', count: selected.available_data?.risk_control_reports || 0, color: '#8b5cf6' },
                    { label: 'Inspections', count: selected.available_data?.inspection_count || 0, color: '#22c55e' },
                  ].map(item => (
                    <div key={item.label} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: item.color }}>{item.count}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                
                {/* ISO Report Card */}
                {(selected.available_data?.iso_reports || 0) > 0 && (
                  <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Building Underwriting Reports (ISO)</h3>
                      <span style={{ background: '#3b82f6', padding: '4px 12px', borderRadius: 12, fontSize: 11, color: 'white' }}>{selected.available_data?.iso_reports} Report(s)</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ color: '#fbbf24' }}>⚠</span>
                        <span style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{selected.last_inspection_date || 'Date Unknown'}</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>- {selected.address}, {selected.city}, {selected.state}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Occupancy</div><div style={{ fontSize: 13, color: 'white' }}>{selected.occupancy_desc}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Square Footage</div><div style={{ fontSize: 13, color: 'white' }}>{selected.sq_footage?.toLocaleString()}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Year Built</div><div style={{ fontSize: 13, color: 'white' }}>{selected.year_built}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Stories</div><div style={{ fontSize: 13, color: 'white' }}>{selected.stories}</div></div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Construction Class</div><div style={{ fontSize: 13, color: 'white' }}>{selected.construction_type}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Sprinkler Info</div><div style={{ fontSize: 13, color: 'white' }}>{selected.sprinkler_status === 'Y' ? 'Sprinklered' : selected.sprinkler_status === 'N' ? 'Not Sprinklered' : 'Partial'}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Protection Class</div><div style={{ fontSize: 13, color: 'white' }}>{selected.fire_protection_class}</div></div>
                        <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Roof Type</div><div style={{ fontSize: 13, color: 'white' }}>{selected.roof_type}</div></div>
                      </div>
                      <button style={{ marginTop: 16, padding: '8px 16px', background: 'transparent', border: '1px solid #ef4444', borderRadius: 6, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>VIEW REPORT</button>
                    </div>
                  </div>
                )}
                
                {/* Last Inspection */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 12 }}>📅 Last Inspection</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 16, color: 'white', fontWeight: 600 }}>{selected.last_inspection_date || 'No inspection on record'}</div>
                    {selected.last_inspection_date && (
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: 12, 
                        fontSize: 11, 
                        background: new Date(selected.last_inspection_date) > new Date(Date.now() - 365*24*60*60*1000) ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                        color: new Date(selected.last_inspection_date) > new Date(Date.now() - 365*24*60*60*1000) ? '#22c55e' : '#ef4444'
                      }}>
                        {new Date(selected.last_inspection_date) > new Date(Date.now() - 365*24*60*60*1000) ? 'Current' : 'Stale (>1 year)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* CAT Hazards Tab */}
            {detailTab === 'cat' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Hurricane', grade: selected.hurricane_grade, score: selected.hurricane, icon: '🌀', color: selected.hurricane >= 7 ? '#ef4444' : selected.hurricane >= 4 ? '#eab308' : '#22c55e' },
                    { label: 'Earthquake', grade: selected.earthquake_grade, score: selected.earthquake, icon: '🔴', color: selected.earthquake >= 7 ? '#ef4444' : selected.earthquake >= 4 ? '#eab308' : '#22c55e' },
                    { label: 'Flood', grade: selected.flood_grade, score: selected.flood_score, icon: '🌊', color: selected.flood_score >= 7 ? '#ef4444' : selected.flood_score >= 4 ? '#eab308' : '#22c55e' },
                    { label: 'Wildfire', grade: selected.wildfire_grade, score: selected.wildfire, icon: '🔥', color: selected.wildfire >= 7 ? '#ef4444' : selected.wildfire >= 4 ? '#eab308' : '#22c55e' },
                    { label: 'Tornado', grade: selected.tornado_grade, score: selected.tornado_hail, icon: '🌪️', color: selected.tornado_hail >= 7 ? '#ef4444' : selected.tornado_hail >= 4 ? '#eab308' : '#22c55e' },
                    { label: 'Hail', grade: selected.hail_grade, score: selected.tornado_hail, icon: '🧊', color: selected.tornado_hail >= 7 ? '#ef4444' : selected.tornado_hail >= 4 ? '#eab308' : '#22c55e' },
                  ].map(peril => (
                    <div key={peril.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{peril.icon}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{peril.label}</div>
                      <div style={{ fontSize: 36, fontWeight: 700, color: peril.color }}>{peril.grade}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Score: {peril.score}/10</div>
                    </div>
                  ))}
                </div>
                
                {/* Flood Zone */}
                <div style={{ marginTop: 20, background: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 12 }}>🌊 Flood Zone Details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>FEMA Zone</div><div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{selected.flood_zone || 'N/A'}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Coast Distance</div><div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{selected.coast_distance || 'N/A'}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Surge Risk</div><div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{selected.surge_risk || 0}/10</div></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Claims Tab */}
            {detailTab === 'claims' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#60a5fa' }}>{selected.total_claims || 0}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Total Claims</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#f97316' }}>{formatCurrency(selected.total_incurred || 0)}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Total Incurred</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#22c55e' }}>{formatCurrency(selected.total_paid || 0)}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Total Paid</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: '#a78bfa' }}>{formatCurrency((selected.total_incurred || 0) - (selected.total_paid || 0))}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Outstanding</div>
                  </div>
                </div>
                
                {/* Claims by Type */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>Claims by Coverage Type</h3>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div style={{ flex: 1, padding: 16, background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#60a5fa' }}>{selected.property_claims || 0}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Property Claims</div>
                    </div>
                    <div style={{ flex: 1, padding: 16, background: 'rgba(168,85,247,0.1)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#a855f7' }}>{selected.gl_claims || 0}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>GL Claims</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Account Info Tab */}
            {detailTab === 'account' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>🏢 Account Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Account Name</div><div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>{selected.account_name}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Named Insured</div><div style={{ fontSize: 14, color: 'white' }}>{selected.named_insured}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Account ID</div><div style={{ fontSize: 12, fontFamily: 'monospace', color: '#60a5fa' }}>{selected.account_id}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Policy Number</div><div style={{ fontSize: 12, fontFamily: 'monospace', color: 'white' }}>{selected.policy_number}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Business Unit</div><div style={{ fontSize: 14, color: 'white' }}>{selected.business_unit}</div></div>
                  </div>
                </div>
                
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>🏭 Business Classification</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>NAICS Code</div><div style={{ fontSize: 14, color: 'white' }}>{selected.naics_code || 'N/A'}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>SIC Code</div><div style={{ fontSize: 14, color: 'white' }}>{selected.sic_code || 'N/A'}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Occupancy</div><div style={{ fontSize: 14, color: 'white' }}>{selected.occupancy_desc}</div></div>
                    <div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Region</div><div style={{ fontSize: 14, color: 'white' }}>{selected.region}</div></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Prior Submissions Tab */}
            {detailTab === 'submissions' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>📁 Submission History ({selected.submission_history?.length || 0} records)</h3>
                {selected.submission_history && selected.submission_history.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selected.submission_history.map((sub: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          <div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>{sub.source}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Broker: {sub.broker} • {sub.date}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#34d399' }}>{formatCurrency(sub.tiv_at_submission)}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>TIV at Submission</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No submission history available</div>
                )}
              </div>
            )}
            
            {/* Data Quality / MDM Tab */}
            {detailTab === 'mdm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Duplicates */}
                {selected.potential_duplicates && selected.potential_duplicates.length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 16 }}>🔴 Potential Duplicates ({selected.potential_duplicates.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selected.potential_duplicates.map((dupe: any, idx: number) => (
                        <div key={idx} style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>{dupe.address}</span>
                            <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: dupe.match_score >= 80 ? 'rgba(239,68,68,0.3)' : dupe.match_score >= 60 ? 'rgba(249,115,22,0.3)' : 'rgba(234,179,8,0.3)', color: dupe.match_score >= 80 ? '#ef4444' : dupe.match_score >= 60 ? '#f97316' : '#eab308' }}>
                              {dupe.match_score}% match
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{dupe.match_reasons?.join(' • ')}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button style={{ padding: '6px 16px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, color: '#22c55e', fontSize: 12, cursor: 'pointer' }}>✓ Merge</button>
                            <button style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', fontSize: 12, cursor: 'pointer' }}>✗ Not Duplicate</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Conflicts */}
                {selected.data_conflicts && selected.data_conflicts.length > 0 && (
                  <div style={{ background: 'rgba(234,179,8,0.08)', borderRadius: 12, padding: 20, border: '1px solid rgba(234,179,8,0.2)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#eab308', marginBottom: 16 }}>⚠️ Data Conflicts ({selected.data_conflicts.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selected.data_conflicts.map((conflict: any, idx: number) => (
                        <div key={idx} style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 12 }}>{conflict.field_label}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
                            <div style={{ padding: 12, background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{conflict.current_source}</div>
                              <div style={{ fontSize: 14, color: '#60a5fa', fontWeight: 600 }}>{conflict.current_value}</div>
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>vs</div>
                            <div style={{ padding: 12, background: 'rgba(249,115,22,0.1)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.3)' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{conflict.conflicting_source}</div>
                              <div style={{ fontSize: 14, color: '#f97316', fontWeight: 600 }}>{conflict.conflicting_value}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>💡 {conflict.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Enrichment */}
                {selected.enrichment_opportunities && selected.enrichment_opportunities.length > 0 && (
                  <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 12, padding: 20, border: '1px solid rgba(139,92,246,0.2)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#8b5cf6', marginBottom: 16 }}>✨ Enrichment Opportunities ({selected.enrichment_opportunities.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selected.enrichment_opportunities.map((enrich: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>{enrich.label}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{enrich.action}</div>
                          </div>
                          {enrich.available && (
                            <button style={{ padding: '6px 16px', background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, color: '#8b5cf6', fontSize: 12, cursor: 'pointer' }}>Enrich Now</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Data Quality Score */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>📊 Data Quality Score</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: `conic-gradient(${selected.data_quality_score >= 80 ? '#22c55e' : selected.data_quality_score >= 60 ? '#eab308' : '#ef4444'} ${selected.data_quality_score * 3.6}deg, rgba(255,255,255,0.1) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#0e0e12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{selected.data_quality_score}%</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>Source System: {selected.source_system}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Last Updated: {selected.last_inspection_date || 'Unknown'}</div>
                      {selected.data_quality_issues && selected.data_quality_issues.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {selected.data_quality_issues.map((issue: string, idx: number) => (
                            <span key={idx} style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(239,68,68,0.2)', borderRadius: 4, fontSize: 10, color: '#ef4444', marginRight: 6, marginTop: 4 }}>{issue.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Fallback for other tabs */}
            {!['summary', 'engineering', 'cat', 'claims', 'account', 'submissions', 'mdm'].includes(detailTab) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 16 }}>Building Overview</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Select a tab above to view detailed information.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
}