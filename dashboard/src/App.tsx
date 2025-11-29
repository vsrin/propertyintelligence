// App.tsx - Property Risk Analytics Dashboard (Modularized)

import { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import portfolioData from './data/portfolio.json';

// Modular imports
import type { Location, ActiveFilter } from './types';
import { MAPBOX_TOKEN, GOOGLE_MAPS_KEY, AI_AGENT_URL, AI_AGENT_ID, EXAMPLE_QUERIES, PERIL_OVERLAYS } from './config';
import { formatCurrency, getMarkerColor, getRiskColor, generateThreadId, parseQuery, processAgentResponse } from './utils';

// Initialize Mapbox
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

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
  const [viewMode, setViewMode] = useState<'street' | 'satellite'>('street');
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [interpretation, setInterpretation] = useState<string>('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showExamples, setShowExamples] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiResponseExpanded, setAiResponseExpanded] = useState(true);
  const [activeOverlays, setActiveOverlays] = useState<string[]>([]);
  
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Computed stats
  const stats = {
    count: filtered.length,
    tiv: filtered.reduce((s, l) => s + l.total_tiv, 0),
    claims: filtered.reduce((s, l) => s + l.total_claims, 0),
    incurred: filtered.reduce((s, l) => s + l.total_incurred, 0),
    alerts: filtered.filter(l => l.has_recommendations === 'Y').length,
  };

  // KPI config
  const kpis = [
    { label: 'Locations', value: stats.count.toString(), color: '#60a5fa' },
    { label: 'Total TIV', value: formatCurrency(stats.tiv), color: '#34d399' },
    { label: 'Avg TIV', value: formatCurrency(stats.tiv / (stats.count || 1)), color: '#22d3ee' },
    { label: 'Claims', value: `${stats.claims}`, sub: formatCurrency(stats.incurred), color: '#fb923c' },
    { label: 'Alerts', value: stats.alerts.toString(), color: stats.alerts > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' },
  ];

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
      
      el.onmouseenter = () => { el.style.boxShadow = `0 0 16px 4px ${color}`; };
      el.onmouseleave = () => { el.style.boxShadow = hasAlert ? `0 0 12px #fbbf24` : '0 2px 6px rgba(0,0,0,0.4)'; };
      el.onclick = (e) => { e.stopPropagation(); setSelected(loc); setViewMode('street'); };

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([loc.lon, loc.lat])
        .addTo(map.current!);
      
      markers.current.push(marker);
    });
  }, [filtered, mapReady]);

  // Close menus on outside click
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
          setViewMode('street');
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

  const getMapUrl = (loc: Location) => {
    if (viewMode === 'street') {
      // source=outdoor forces street-level view instead of indoor imagery
      return `https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${loc.lat},${loc.lon}&fov=90&source=outdoor`;
    }
    return `https://www.google.com/maps/embed/v1/view?key=${GOOGLE_MAPS_KEY}&center=${loc.lat},${loc.lon}&zoom=19&maptype=satellite`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#0a0a0f', color: 'white', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", overflow: 'hidden' }}>
      
      {/* Header */}
      <header style={{ height: 60, background: 'linear-gradient(180deg, #0f0f14 0%, #0a0a0f 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', padding: '0 24px', flexShrink: 0 }}>
        
        {/* Logo */}
        <div style={{ flex: '0 0 200px', display: 'flex', alignItems: 'center' }}>
          <img src="/elevatenowlogo.png" alt="ElevateNow" style={{ height: 36, width: 'auto', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        
        {/* Search */}
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
        
        {/* User Menu */}
        <div style={{ flex: '0 0 200px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
      {(interpretation || activeFilters.length > 0) && (
        <div style={{ background: interpretation.startsWith('🤖') ? 'rgba(139,92,246,0.08)' : 'rgba(59,130,246,0.08)', borderBottom: `1px solid ${interpretation.startsWith('🤖') ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)'}`, flexShrink: 0, overflow: 'hidden' }}>
          <div onClick={() => interpretation.startsWith('🤖') && setAiResponseExpanded(!aiResponseExpanded)} style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, cursor: interpretation.startsWith('🤖') ? 'pointer' : 'default' }}>
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
            {activeFilters.length > 0 && (
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
      <div style={{ height: 84, background: '#0c0c10', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', padding: '0 24px', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ flex: 1, background: hoveredKpi === kpi.label ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${hoveredKpi === kpi.label ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={() => setHoveredKpi(kpi.label)} onMouseLeave={() => setHoveredKpi(null)}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</span>
              {kpi.sub && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{kpi.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          
          {/* Legend */}
          <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(20,20,25,0.92)', backdropFilter: 'blur(16px)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>TIV Range</div>
            {[{ c: '#3b82f6', l: '< $500K' }, { c: '#22c55e', l: '$500K - $2M' }, { c: '#eab308', l: '$2M - $10M' }, { c: '#f97316', l: '$10M - $50M' }, { c: '#ef4444', l: '> $50M' }].map(i => (
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
          
          {/* Layer Controls */}
          <div style={{ position: 'absolute', top: 20, left: 24, background: 'rgba(20,20,25,0.92)', backdropFilter: 'blur(16px)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 10, display: 'flex', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', marginRight: 4 }}>Layers</div>
            {Object.entries(PERIL_OVERLAYS).map(([key, config]) => {
              const isActive = activeOverlays.includes(key);
              return (
                <button key={key} onClick={() => toggleOverlay(key)} title={config.name} style={{ width: 36, height: 36, borderRadius: 8, background: isActive ? `${config.color}25` : 'rgba(255,255,255,0.05)', border: isActive ? `2px solid ${config.color}` : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s', boxShadow: isActive ? `0 0 12px ${config.color}40` : 'none' }}>
                  {config.icon}
                </button>
              );
            })}
          </div>
          
          {/* Count Badge */}
          <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(20,20,25,0.92)', backdropFilter: 'blur(16px)', borderRadius: 12, padding: '12px 20px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{filtered.length}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>{filtered.length === locations.length ? 'locations' : `of ${locations.length}`}</span>
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{ width: 460, background: '#0e0e12', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: 260, position: 'relative', background: '#18181b', flexShrink: 0 }}>
              <iframe key={`${selected.location_id}-${viewMode}`} style={{ width: '100%', height: '100%', border: 'none' }} src={getMapUrl(selected)} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <div style={{ position: 'absolute', bottom: 80, right: 14, display: 'flex', gap: 6, zIndex: 10 }}>
                <button onClick={() => setViewMode('satellite')} style={{ padding: '6px 12px', background: viewMode === 'satellite' ? '#3b82f6' : 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>Satellite</button>
                <button onClick={() => setViewMode('street')} style={{ padding: '6px 12px', background: viewMode === 'street' ? '#3b82f6' : 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(8px)' }}>Street</button>
              </div>
              <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, #0e0e12)', padding: '48px 20px 16px', zIndex: 5 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{selected.address}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{selected.city}, {selected.state} {selected.zip}</div>
              </div>
            </div>
            
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
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: selected.sprinkler_status === 'Fully Sprinklered' ? '#22c55e' : '#eab308' }}>{selected.sprinkler_status === 'Fully Sprinklered' ? 'Sprinklered' : 'Partial/None'}</div>
                </div>
              </div>
              
              {/* CAT Hazards */}
              <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 18, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>CAT Hazards</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[{ l: 'Hurricane', v: selected.hurricane }, { l: 'Earthquake', v: selected.earthquake }, { l: 'Tornado', v: selected.tornado_hail }, { l: 'Surge', v: selected.surge_risk }, { l: 'Wildfire', v: selected.wildfire }, { l: 'Flood', v: selected.flood_score }].map(h => (
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}