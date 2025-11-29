// types.ts - TypeScript interfaces for Property Risk Analytics Dashboard

export interface Location {
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
  
  export interface ActiveFilter {
    id: string;
    label: string;
    type: string;
  }
  
  export interface SearchResult {
    locations: Location[];
    filters: ActiveFilter[];
    interpretation: string;
  }
  
  export interface AgentResult {
    filteredLocations: Location[];
    selectedLocation: Location | null;
    interpretation: string;
    mapBounds: MapBounds | null;
    suggestions: string[];
  }
  
  export interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
  }
  
  export interface PerilOverlay {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    tiles: string[];
    legendItems: { color: string; label: string }[];
  }