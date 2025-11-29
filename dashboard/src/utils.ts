// utils.ts - Utility functions for Property Risk Analytics Dashboard

import type { Location, SearchResult, ActiveFilter, AgentResult, MapBounds } from './types';

// ============================================================================
// Formatting Utilities
// ============================================================================

export const formatCurrency = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export const getMarkerColor = (tiv: number): string => {
  if (tiv < 500000) return '#3b82f6';
  if (tiv < 2000000) return '#22c55e';
  if (tiv < 10000000) return '#eab308';
  if (tiv < 50000000) return '#f97316';
  return '#ef4444';
};

export const getRiskColor = (score: number): string => {
  if (score <= 3) return '#22c55e';
  if (score <= 5) return '#eab308';
  if (score <= 7) return '#f97316';
  return '#ef4444';
};

export const generateThreadId = () => Math.floor(Math.random() * 1000000);

// ============================================================================
// Query Parser - Natural language search
// ============================================================================

export const parseQuery = (query: string, locations: Location[]): SearchResult => {
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

  // MDM - Duplicate detection
  if (q.includes('duplicate') || q.includes('duplicates') || q.includes('potential match')) {
    result = result.filter(l => l.potential_duplicates?.length > 0);
    filters.push({ id: 'duplicates', label: 'Has Duplicates', type: 'mdm' });
    interpretations.push(`with potential duplicates`);
  }

  // MDM - Data conflicts
  if (q.includes('conflict') || q.includes('conflicts') || q.includes('discrepan') || q.includes('mismatch')) {
    result = result.filter(l => l.data_conflicts?.length > 0);
    filters.push({ id: 'conflicts', label: 'Has Conflicts', type: 'mdm' });
    interpretations.push(`with data conflicts`);
  }

  // MDM - Sprinkler conflicts specifically
  if (q.includes('sprinkler conflict') || q.includes('sprinkler mismatch')) {
    result = result.filter(l => l.data_conflicts?.some((c: any) => c.field === 'sprinkler_status'));
    filters.push({ id: 'sprinkler-conflicts', label: 'Sprinkler Conflicts', type: 'mdm' });
    interpretations.push(`with sprinkler conflicts`);
  }

  // MDM - Enrichment opportunities
  if (q.includes('enrich') || q.includes('enrichment') || q.includes('need') && q.includes('data')) {
    result = result.filter(l => l.enrichment_opportunities?.length > 0);
    filters.push({ id: 'enrichment', label: 'Needs Enrichment', type: 'mdm' });
    interpretations.push(`needing enrichment`);
  }

  // MDM - Nearmap enrichment specifically
  if (q.includes('nearmap')) {
    if (q.includes('need') || q.includes('enrichment') || q.includes('missing')) {
      result = result.filter(l => l.enrichment_opportunities?.some((e: any) => e.type === 'sqft' && e.available));
      filters.push({ id: 'nearmap-enrich', label: 'Nearmap Available', type: 'mdm' });
      interpretations.push(`with Nearmap enrichment available`);
    } else {
      result = result.filter(l => l.available_data?.nearmap_available);
      filters.push({ id: 'nearmap', label: 'Has Nearmap', type: 'data' });
      interpretations.push(`with Nearmap imagery`);
    }
  }

  // MDM - ISO report conflicts
  if (q.includes('iso') && (q.includes('conflict') || q.includes('report'))) {
    result = result.filter(l => l.data_conflicts?.some((c: any) => c.conflicting_source?.includes('ISO')));
    filters.push({ id: 'iso-conflicts', label: 'ISO Conflicts', type: 'mdm' });
    interpretations.push(`with ISO report conflicts`);
  }

  // MDM - Multiple submissions
  if (q.includes('multiple') && q.includes('submis') || q.includes('submitted') && (q.includes('multiple') || q.includes('times'))) {
    result = result.filter(l => l.submission_history?.length > 1);
    filters.push({ id: 'multi-submit', label: 'Multiple Submissions', type: 'mdm' });
    interpretations.push(`submitted multiple times`);
  }

  // MDM - Stale inspections
  if (q.includes('stale') || (q.includes('inspection') && (q.includes('old') || q.includes('overdue')))) {
    result = result.filter(l => l.data_quality_issues?.includes('stale_inspection'));
    filters.push({ id: 'stale-inspection', label: 'Stale Inspection', type: 'mdm' });
    interpretations.push(`with stale inspections`);
  }

  // MDM - Missing construction
  if (q.includes('missing') && q.includes('construction')) {
    result = result.filter(l => l.data_quality_issues?.includes('missing_construction'));
    filters.push({ id: 'missing-const', label: 'Missing Construction', type: 'mdm' });
    interpretations.push(`missing construction data`);
  }

  // Account/Customer 360 filters
  if (q.includes('customer 360') || q.includes('account') || q.includes('show all') && q.includes('for')) {
    // Try to find account name in query
    const accountNames = [...new Set(locations.map(l => l.account_name))];
    for (const accName of accountNames) {
      if (q.toLowerCase().includes(accName.toLowerCase().split(' ')[0].toLowerCase())) {
        result = result.filter(l => l.account_name === accName);
        filters.push({ id: `account-${accName}`, label: accName, type: 'account' });
        interpretations.push(`${accName} (Customer 360)`);
        break;
      }
    }
  }

  // Healthcare/Hospital
  if (q.includes('healthcare') || q.includes('hospital') || q.includes('medical')) {
    result = result.filter(l => 
      l.occupancy_desc?.toLowerCase().includes('hospital') || 
      l.occupancy_desc?.toLowerCase().includes('medical') ||
      l.account_name?.toLowerCase().includes('medical') ||
      l.account_name?.toLowerCase().includes('health')
    );
    filters.push({ id: 'healthcare', label: 'Healthcare', type: 'occupancy' });
    interpretations.push(`healthcare`);
  }

  // University/College
  if (q.includes('university') || q.includes('college') || q.includes('campus')) {
    result = result.filter(l => 
      l.occupancy_desc?.toLowerCase().includes('college') || 
      l.occupancy_desc?.toLowerCase().includes('school') ||
      l.account_name?.toLowerCase().includes('university') ||
      l.account_name?.toLowerCase().includes('college')
    );
    filters.push({ id: 'university', label: 'University', type: 'occupancy' });
    interpretations.push(`university/college`);
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

// ============================================================================
// AI Agent Response Processing
// ============================================================================

export const processAgentResponse = (agentResponse: any, allLocations: Location[]): AgentResult => {
  // API returns { response: "stringified JSON" } - need to parse it
  let result;
  
  if (agentResponse.response) {
    try {
      result = JSON.parse(agentResponse.response);
    } catch (e) {
      console.error('Failed to parse agent response:', e);
      result = {};
    }
  } else if (agentResponse.metadata) {
    result = agentResponse.metadata;
  } else {
    result = agentResponse;
  }
  
  const responseText = result.response_text || '';
  const actions = result.actions || [];
  const suggestions = result.follow_up_suggestions || [];
  
  let filteredLocs = allLocations;
  let selectedLoc: Location | null = null;
  let mapBounds: MapBounds | null = null;
  
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