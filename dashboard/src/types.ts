// types.ts - Enhanced TypeScript interfaces for Property Risk Analytics Dashboard
// Supports account-centric MDM model with data quality indicators

export interface Account {
  account_id: string;
  account_name: string;
  account_type: string;
  hq_city: string;
  hq_state: string;
  hq_lat: number;
  hq_lon: number;
  region: string;
  naics: string;
  sic: string;
  annual_revenue: number;
  employees: number;
  years_in_business: number;
  broker_name: string;
  broker_city: string;
  broker_state: string;
  existing_carriers: string[];
  num_locations: number;
}

export interface AvailableData {
  iso_reports: number;
  risk_control_reports: number;
  claims_count: number;
  inspection_count: number;
  nearmap_available: boolean;
}

export interface Location {
  // Identity
  location_id: string;
  account_id: string;
  account_name: string;
  parent_location_id: string | null;
  building_name: string;
  is_main_building: boolean;
  
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  lat: number;
  lon: number;
  region: string;
  
  // COPE
  construction_code: string | null;
  construction_type: string;
  year_built: number;
  stories: number;
  sq_footage: number | null;
  occupancy_desc: string;
  roof_type: string;
  roof_shape: string;
  
  // Protection
  sprinkler_status: string;
  fire_protection_class: string;
  fire_hydrant_distance: string;
  coast_distance: string;
  
  // Exposure
  building_value: number;
  contents_value: number;
  bii_value: number;
  total_tiv: number;
  
  // Perils - Numeric Scores (1-10)
  hurricane: number;
  earthquake: number;
  flood_score: number;
  wildfire: number;
  tornado_hail: number;
  surge_risk: number;
  terrorism: number;
  
  // Perils - Letter Grades (A/B/C/D/F)
  hurricane_grade: string;
  earthquake_grade: string;
  flood_grade: string;
  flood_zone: string;
  wildfire_grade: string;
  wildfire_desc: string;
  tornado_grade: string;
  hail_grade: string;
  wind_grade: string;
  
  // Claims
  total_claims: number;
  total_incurred: number;
  total_paid: number;
  property_claims: number;
  gl_claims: number;
  
  // Risk Control
  has_recommendations: string;
  rc_category: string;
  rc_title: string;
  rc_text: string;
  rc_job_number: string;
  
  // Data Quality / MDM
  data_quality_score: number;
  data_quality_issues: string[];
  last_inspection_date: string;
  source_system: string;
  
  // Available linked data
  available_data: AvailableData;
  
  // Policy info
  named_insured: string;
  policy_number: string;
  business_unit: string;
  sic_code: string;
  naics_code: string;
  
  // Allow additional properties
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

// Portfolio summary for dashboard KPIs
export interface PortfolioSummary {
  totalAccounts: number;
  totalLocations: number;
  totalTIV: number;
  avgTIV: number;
  totalClaims: number;
  locationsWithAlerts: number;
  dataQualityPct: number;
  statesRepresented: number;
}

// View mode for switching between location and account views
export type ViewMode = 'locations' | 'accounts';

// Grade color mapping
export const GRADE_COLORS: Record<string, string> = {
  'A': '#22c55e',  // Green
  'B': '#84cc16',  // Lime
  'C': '#eab308',  // Yellow
  'D': '#f97316',  // Orange
  'F': '#ef4444',  // Red
};

// Data quality issue labels
export const DATA_QUALITY_LABELS: Record<string, string> = {
  'missing_coordinates': 'Missing Geocode',
  'missing_construction': 'Missing Construction',
  'missing_sqft': 'Missing Square Footage',
  'stale_inspection': 'Stale Inspection (>3 yrs)',
  'data_conflict': 'Data Conflict',
};