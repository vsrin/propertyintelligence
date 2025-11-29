#!/bin/bash

# =============================================================================
# PropertyRisk Portfolio Analytics Dashboard - Setup Script
# =============================================================================
# For use in existing PROPERTYINTEL directory
#
# Prerequisites:
#   - Node.js 20.19+ or 22.12+ (use nvm to manage versions)
#
# Usage:
#   cd ~/path/to/PROPERTYINTEL
#   chmod +x setup_propertyrisk_dashboard.sh
#   ./setup_propertyrisk_dashboard.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  PropertyRisk Dashboard Setup${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 0: Check Node.js Version
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Checking Node.js version...${NC}"

NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)

if [ -z "$NODE_VERSION" ]; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Install Node.js 22 using nvm:"
    echo "  nvm install 22 && nvm use 22"
    exit 1
fi

if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js v$NODE_VERSION is too old. Need 20.19+ or 22+${NC}"
    echo "Upgrade using: nvm install 22 && nvm use 22"
    exit 1
fi

echo -e "${GREEN}  ✓ Node.js $(node -v) OK${NC}"

# -----------------------------------------------------------------------------
# Step 1: Create React App Subdirectory
# -----------------------------------------------------------------------------
DASHBOARD_DIR="dashboard"

echo -e "${YELLOW}Creating dashboard directory...${NC}"

if [ -d "$DASHBOARD_DIR" ]; then
    echo -e "${YELLOW}  Removing existing dashboard directory...${NC}"
    rm -rf "$DASHBOARD_DIR"
fi

mkdir -p "$DASHBOARD_DIR"
cd "$DASHBOARD_DIR"

echo -e "${GREEN}  ✓ Created $(pwd)${NC}"

# -----------------------------------------------------------------------------
# Step 2: Initialize Project
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Initializing npm project...${NC}"

cat > package.json << 'EOF'
{
  "name": "propertyrisk-dashboard",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
EOF

echo "22" > .nvmrc

echo -e "${GREEN}  ✓ package.json created${NC}"

# -----------------------------------------------------------------------------
# Step 3: Install Dependencies
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Installing dependencies (this may take a minute)...${NC}"

npm install react react-dom 2>/dev/null
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom 2>/dev/null
npm install react-map-gl mapbox-gl @react-google-maps/api 2>/dev/null
npm install zustand lucide-react clsx tailwind-merge xlsx 2>/dev/null
npm install -D tailwindcss postcss autoprefixer @types/mapbox-gl 2>/dev/null

echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# -----------------------------------------------------------------------------
# Step 4: Create Config Files
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Creating configuration files...${NC}"

# Vite config
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  resolve: { alias: { '@': '/src' } }
})
EOF

# TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
EOF

# Tailwind config
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
        risk: { low: '#22c55e', moderate: '#eab308', high: '#f97316', severe: '#ef4444' },
        peril: { hurricane: '#8b5cf6', earthquake: '#f59e0b', flood: '#3b82f6', wildfire: '#ef4444', tornado: '#6366f1', surge: '#06b6d4' },
        panel: { bg: '#1f2937', header: '#111827', border: '#374151' }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
EOF

cat > postcss.config.js << 'EOF'
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
EOF

# Environment file
cat > .env << 'EOF'
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiZWxldmF0ZW5vdyIsImEiOiJjbWlqZDczejExNGJyM2NxODNtcjk4NXZzIn0.-boLEfnCFHAxHsD7XoazkA
VITE_GOOGLE_MAPS_KEY=AIzaSyAbw4ANv1qoB4UW4RM19tGNy1dSTu3QQug
VITE_ELEVATENOW_API_URL=https://api.elevatenow.ai
VITE_ELEVATENOW_API_KEY=
VITE_ENABLE_AI_AGENTS=true
VITE_ENABLE_STREET_VIEW=true
VITE_ENABLE_PERIL_OVERLAYS=true
EOF

# Gitignore
cat > .gitignore << 'EOF'
node_modules
dist
.env
.env.local
.DS_Store
EOF

echo -e "${GREEN}  ✓ Config files created${NC}"

# -----------------------------------------------------------------------------
# Step 5: Create Directory Structure
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Creating directory structure...${NC}"

mkdir -p src/components/{map,filters,location-detail,ai-agents,common}
mkdir -p src/{hooks,store,types,utils,data,styles,services}
mkdir -p public/data

echo -e "${GREEN}  ✓ Directories created${NC}"

# -----------------------------------------------------------------------------
# Step 6: Create Source Files
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Creating source files...${NC}"

# index.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PropertyRisk Analytics Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# vite-env.d.ts
cat > src/vite-env.d.ts << 'EOF'
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_GOOGLE_MAPS_KEY: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
EOF

# styles/index.css
cat > src/styles/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; }

.mapboxgl-popup-content { @apply bg-panel-bg text-white rounded-lg shadow-xl border border-panel-border p-0; }
.mapboxgl-ctrl-logo { display: none !important; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { @apply bg-gray-800; }
::-webkit-scrollbar-thumb { @apply bg-gray-600 rounded; }

.panel-slide-in { animation: slideIn 0.3s ease-out; }
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
EOF

# types/index.ts
cat > src/types/index.ts << 'EOF'
export interface Location {
  location_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  lat: number;
  lon: number;
  division: string;
  building_value: number;
  contents_value: number;
  bii_value: number;
  total_tiv: number;
  construction_code: string;
  construction_desc: string;
  year_built: number;
  stories: number;
  sq_footage: number;
  occupancy_code: string;
  occupancy_desc: string;
  sprinkler_status: string;
  protection_class: string;
  hurricane: number;
  earthquake: number;
  tornado_hail: number;
  wildfire: number;
  flood_score: number;
  flood_zone: string;
  flood_desc: string;
  surge_risk: number;
  terrorism: number;
  property_claims: number;
  property_incurred: number;
  gl_claims: number;
  gl_incurred: number;
  total_claims: number;
  total_incurred: number;
  total_paid: number;
  named_insured: string;
  policy_number: string;
  policy_term_start: string;
  policy_term_end: string;
  business_unit: string;
  lob: string;
  sai: string;
  sic_code: string;
  naics_code: string;
  has_recommendations: 'Y' | 'N';
  rc_job_number: string;
  rc_category: string;
  rc_title: string;
  rc_text: string;
}

export interface FilterState {
  states: string[];
  divisions: string[];
  constructionCodes: string[];
  occupancyCodes: string[];
  sprinklerStatus: string[];
  yearBuiltRange: [number, number];
  tivRange: [number, number];
  hurricaneRange: [number, number];
  earthquakeRange: [number, number];
  floodRange: [number, number];
  wildfireRange: [number, number];
  tornadoRange: [number, number];
  hasRecommendations: boolean | null;
  searchQuery: string;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export type PerilLayer = 'hurricane' | 'earthquake' | 'flood' | 'wildfire' | 'tornado' | 'surge';

export interface MapState {
  viewState: MapViewState;
  activePerilLayers: PerilLayer[];
  showClusters: boolean;
  showHeatmap: boolean;
  selectedLocationId: string | null;
}

export interface PortfolioStats {
  totalLocations: number;
  totalTIV: number;
  avgTIV: number;
  totalClaims: number;
  totalIncurred: number;
  locationsWithRecommendations: number;
  stateDistribution: Record<string, number>;
  divisionDistribution: Record<string, number>;
  constructionDistribution: Record<string, number>;
  perilAverages: { hurricane: number; earthquake: number; flood: number; wildfire: number; tornado: number; };
}
EOF

# utils/index.ts
cat > src/utils/index.ts << 'EOF'
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Location, PortfolioStats } from '../types';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatSqFt(value: number): string {
  return `${formatNumber(value)} sq ft`;
}

export function getRiskLevel(score: number): 'low' | 'moderate' | 'high' | 'severe' {
  if (score <= 2) return 'low';
  if (score <= 5) return 'moderate';
  if (score <= 7) return 'high';
  return 'severe';
}

export function getRiskColor(score: number): string {
  const colors = { low: '#22c55e', moderate: '#eab308', high: '#f97316', severe: '#ef4444' };
  return colors[getRiskLevel(score)];
}

export function getPerilColor(peril: string): string {
  const colors: Record<string, string> = { hurricane: '#8b5cf6', earthquake: '#f59e0b', flood: '#3b82f6', wildfire: '#ef4444', tornado: '#6366f1', surge: '#06b6d4' };
  return colors[peril] || '#6b7280';
}

export function calculateStats(locations: Location[]): PortfolioStats {
  if (locations.length === 0) return { totalLocations: 0, totalTIV: 0, avgTIV: 0, totalClaims: 0, totalIncurred: 0, locationsWithRecommendations: 0, stateDistribution: {}, divisionDistribution: {}, constructionDistribution: {}, perilAverages: { hurricane: 0, earthquake: 0, flood: 0, wildfire: 0, tornado: 0 } };
  
  const totalTIV = locations.reduce((sum, l) => sum + l.total_tiv, 0);
  const stateDistribution: Record<string, number> = {};
  const divisionDistribution: Record<string, number> = {};
  const constructionDistribution: Record<string, number> = {};
  
  locations.forEach((l) => {
    stateDistribution[l.state] = (stateDistribution[l.state] || 0) + 1;
    divisionDistribution[l.division] = (divisionDistribution[l.division] || 0) + 1;
    constructionDistribution[l.construction_code] = (constructionDistribution[l.construction_code] || 0) + 1;
  });
  
  return {
    totalLocations: locations.length,
    totalTIV,
    avgTIV: totalTIV / locations.length,
    totalClaims: locations.reduce((sum, l) => sum + l.total_claims, 0),
    totalIncurred: locations.reduce((sum, l) => sum + l.total_incurred, 0),
    locationsWithRecommendations: locations.filter((l) => l.has_recommendations === 'Y').length,
    stateDistribution,
    divisionDistribution,
    constructionDistribution,
    perilAverages: {
      hurricane: locations.reduce((sum, l) => sum + l.hurricane, 0) / locations.length,
      earthquake: locations.reduce((sum, l) => sum + l.earthquake, 0) / locations.length,
      flood: locations.reduce((sum, l) => sum + l.flood_score, 0) / locations.length,
      wildfire: locations.reduce((sum, l) => sum + l.wildfire, 0) / locations.length,
      tornado: locations.reduce((sum, l) => sum + l.tornado_hail, 0) / locations.length,
    },
  };
}

export function getMarkerColorByTIV(tiv: number): string {
  if (tiv >= 50_000_000) return '#ef4444';
  if (tiv >= 10_000_000) return '#f97316';
  if (tiv >= 2_000_000) return '#eab308';
  if (tiv >= 500_000) return '#22c55e';
  return '#3b82f6';
}
EOF

# store/useStore.ts
cat > src/store/useStore.ts << 'EOF'
import { create } from 'zustand';
import { Location, FilterState, MapState, PortfolioStats, PerilLayer } from '../types';

const defaultFilters: FilterState = {
  states: [], divisions: [], constructionCodes: [], occupancyCodes: [], sprinklerStatus: [],
  yearBuiltRange: [1960, 2024], tivRange: [0, 200000000],
  hurricaneRange: [0, 10], earthquakeRange: [0, 10], floodRange: [0, 10], wildfireRange: [0, 10], tornadoRange: [0, 10],
  hasRecommendations: null, searchQuery: '',
};

const defaultMapState: MapState = {
  viewState: { longitude: -98.5795, latitude: 39.8283, zoom: 4, pitch: 0, bearing: 0 },
  activePerilLayers: [], showClusters: true, showHeatmap: false, selectedLocationId: null,
};

interface AppStore {
  locations: Location[];
  filteredLocations: Location[];
  stats: PortfolioStats | null;
  isLoading: boolean;
  filters: FilterState;
  mapState: MapState;
  setLocations: (locations: Location[]) => void;
  setStats: (stats: PortfolioStats) => void;
  setIsLoading: (loading: boolean) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  applyFilters: () => void;
  setMapViewState: (viewState: Partial<MapState['viewState']>) => void;
  togglePerilLayer: (layer: PerilLayer) => void;
  setSelectedLocation: (locationId: string | null) => void;
  toggleClusters: () => void;
  toggleHeatmap: () => void;
  getSelectedLocation: () => Location | null;
}

export const useStore = create<AppStore>((set, get) => ({
  locations: [], filteredLocations: [], stats: null, isLoading: true, filters: defaultFilters, mapState: defaultMapState,
  
  setLocations: (locations) => { set({ locations, filteredLocations: locations }); get().applyFilters(); },
  setStats: (stats) => set({ stats }),
  setIsLoading: (isLoading) => set({ isLoading }),
  
  setFilters: (newFilters) => { set((state) => ({ filters: { ...state.filters, ...newFilters } })); get().applyFilters(); },
  resetFilters: () => { set({ filters: defaultFilters }); get().applyFilters(); },
  
  applyFilters: () => {
    const { locations, filters } = get();
    const filtered = locations.filter((loc) => {
      if (filters.states.length > 0 && !filters.states.includes(loc.state)) return false;
      if (filters.divisions.length > 0 && !filters.divisions.includes(loc.division)) return false;
      if (filters.constructionCodes.length > 0 && !filters.constructionCodes.includes(loc.construction_code)) return false;
      if (loc.year_built < filters.yearBuiltRange[0] || loc.year_built > filters.yearBuiltRange[1]) return false;
      if (loc.total_tiv < filters.tivRange[0] || loc.total_tiv > filters.tivRange[1]) return false;
      if (filters.hasRecommendations !== null && (loc.has_recommendations === 'Y') !== filters.hasRecommendations) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        if (![loc.address, loc.city, loc.state, loc.named_insured].some(f => f.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    set({ filteredLocations: filtered });
  },
  
  setMapViewState: (viewState) => set((state) => ({ mapState: { ...state.mapState, viewState: { ...state.mapState.viewState, ...viewState } } })),
  togglePerilLayer: (layer) => set((state) => ({ mapState: { ...state.mapState, activePerilLayers: state.mapState.activePerilLayers.includes(layer) ? state.mapState.activePerilLayers.filter((l) => l !== layer) : [...state.mapState.activePerilLayers, layer] } })),
  setSelectedLocation: (locationId) => set((state) => ({ mapState: { ...state.mapState, selectedLocationId: locationId } })),
  toggleClusters: () => set((state) => ({ mapState: { ...state.mapState, showClusters: !state.mapState.showClusters } })),
  toggleHeatmap: () => set((state) => ({ mapState: { ...state.mapState, showHeatmap: !state.mapState.showHeatmap } })),
  getSelectedLocation: () => { const { locations, mapState } = get(); return mapState.selectedLocationId ? locations.find((l) => l.location_id === mapState.selectedLocationId) || null : null; },
}));
EOF

# Components
cat > src/components/common/Header.tsx << 'EOF'
import { Building2, Bot } from 'lucide-react';

export function Header() {
  return (
    <header className="h-14 bg-panel-header border-b border-panel-border flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Building2 className="w-8 h-8 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold">PropertyRisk Analytics</h1>
          <p className="text-xs text-gray-400">Portfolio Intelligence Dashboard</p>
        </div>
      </div>
      <button className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm transition-colors">
        <Bot className="w-4 h-4" />
        AI Assistant
      </button>
    </header>
  );
}
EOF

cat > src/components/common/StatsBar.tsx << 'EOF'
import { useStore } from '../../store/useStore';
import { formatCurrency, formatNumber } from '../../utils';

export function StatsBar() {
  const { stats, filteredLocations } = useStore();
  if (!stats) return null;
  
  return (
    <div className="h-12 bg-panel-bg border-b border-panel-border flex items-center px-4 gap-8 text-sm">
      <div><span className="text-gray-400">Locations: </span><span className="font-semibold">{formatNumber(filteredLocations.length)}</span><span className="text-gray-500"> / {stats.totalLocations}</span></div>
      <div><span className="text-gray-400">Total TIV: </span><span className="font-semibold">{formatCurrency(stats.totalTIV)}</span></div>
      <div><span className="text-gray-400">Claims: </span><span className="font-semibold">{formatNumber(stats.totalClaims)}</span></div>
      <div><span className="text-gray-400">Incurred: </span><span className="font-semibold">{formatCurrency(stats.totalIncurred)}</span></div>
      <div><span className="text-gray-400">Risk Alerts: </span><span className="font-semibold text-yellow-500">{stats.locationsWithRecommendations}</span></div>
    </div>
  );
}
EOF

cat > src/components/map/MapContainer.tsx << 'EOF'
import { useStore } from '../../store/useStore';

export function MapContainer() {
  const { filteredLocations, isLoading } = useStore();
  
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mb-4 mx-auto" />
          <p className="text-gray-400">Loading portfolio data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
      <div className="text-center p-8 bg-panel-bg rounded-xl border border-panel-border">
        <p className="text-xl text-gray-300 mb-2">🗺️ Map Container</p>
        <p className="text-gray-500 mb-4">Mapbox GL JS integration pending</p>
        <p className="text-primary-400 text-sm">{filteredLocations.length} locations ready</p>
      </div>
    </div>
  );
}
EOF

cat > src/components/filters/FilterPanel.tsx << 'EOF'
import { Filter, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';

export function FilterPanel() {
  const { resetFilters } = useStore();
  
  return (
    <div className="w-72 bg-panel-bg border-r border-panel-border flex flex-col">
      <div className="p-4 border-b border-panel-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary-500" />
          <h2 className="font-semibold">Filters</h2>
        </div>
        <button onClick={resetFilters} className="p-1.5 hover:bg-gray-700 rounded" title="Reset">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-gray-500 text-sm p-4 bg-gray-800 rounded-lg">
          Filter controls will be implemented here
        </div>
      </div>
    </div>
  );
}
EOF

cat > src/components/location-detail/LocationDetailPanel.tsx << 'EOF'
import { X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Location } from '../../types';
import { formatCurrency, formatSqFt } from '../../utils';

export function LocationDetailPanel({ location }: { location: Location }) {
  const { setSelectedLocation } = useStore();
  
  return (
    <div className="absolute right-0 top-0 h-full w-[480px] bg-panel-bg border-l border-panel-border shadow-xl panel-slide-in flex flex-col">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg">{location.address}</h2>
            <p className="text-gray-400 text-sm">{location.city}, {location.state} {location.zip}</p>
          </div>
          <button onClick={() => setSelectedLocation(null)} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 h-40 bg-gray-700 rounded-lg flex items-center justify-center">
          <p className="text-gray-500 text-sm">Street View placeholder</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Total TIV</p>
            <p className="text-xl font-semibold">{formatCurrency(location.total_tiv)}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Sq Footage</p>
            <p className="text-xl font-semibold">{formatSqFt(location.sq_footage)}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Year Built</p>
            <p className="text-xl font-semibold">{location.year_built}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Construction</p>
            <p className="text-xl font-semibold">{location.construction_code}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

cat > src/components/ai-agents/AIAgentPanel.tsx << 'EOF'
import { Search, FileText, HelpCircle } from 'lucide-react';

export function AIAgentPanel() {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2">
      <button className="w-12 h-12 bg-primary-600 hover:bg-primary-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110" title="Query">
        <Search className="w-5 h-5" />
      </button>
      <button className="w-12 h-12 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110" title="Summary">
        <FileText className="w-5 h-5" />
      </button>
      <button className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110" title="Ask Location">
        <HelpCircle className="w-5 h-5" />
      </button>
    </div>
  );
}
EOF

# App.tsx
cat > src/App.tsx << 'EOF'
import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { calculateStats } from './utils';
import { MapContainer } from './components/map/MapContainer';
import { FilterPanel } from './components/filters/FilterPanel';
import { LocationDetailPanel } from './components/location-detail/LocationDetailPanel';
import { AIAgentPanel } from './components/ai-agents/AIAgentPanel';
import { Header } from './components/common/Header';
import { StatsBar } from './components/common/StatsBar';
import portfolioData from './data/portfolio.json';

function App() {
  const { setLocations, setStats, setIsLoading } = useStore();
  const selectedLocation = useStore((state) => state.getSelectedLocation());

  useEffect(() => {
    const locations = portfolioData as any[];
    if (locations.length > 0) {
      setLocations(locations);
      setStats(calculateStats(locations));
    }
    setIsLoading(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      <Header />
      <StatsBar />
      <div className="flex-1 flex overflow-hidden">
        <FilterPanel />
        <div className="flex-1 relative">
          <MapContainer />
          {selectedLocation && <LocationDetailPanel location={selectedLocation} />}
        </div>
      </div>
      <AIAgentPanel />
    </div>
  );
}

export default App;
EOF

# main.tsx
cat > src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import 'mapbox-gl/dist/mapbox-gl.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
EOF

# Empty data placeholder
cat > src/data/portfolio.json << 'EOF'
[]
EOF

echo -e "${GREEN}  ✓ Source files created${NC}"

# -----------------------------------------------------------------------------
# Step 7: Copy Portfolio Data
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Copying portfolio data from parent directory...${NC}"

if [ -f "../property_portfolio.json" ]; then
    cp ../property_portfolio.json src/data/portfolio.json
    echo -e "${GREEN}  ✓ Portfolio data copied${NC}"
else
    echo -e "${YELLOW}  ⚠ property_portfolio.json not found in parent directory${NC}"
    echo -e "${YELLOW}    Please copy manually: cp ../property_portfolio.json src/data/portfolio.json${NC}"
fi

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "Dashboard created at: ${BLUE}$(pwd)${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "  1. Make sure portfolio data is in place:"
echo -e "     ${BLUE}ls src/data/portfolio.json${NC}"
echo ""
echo "  2. If not, copy it:"
echo -e "     ${BLUE}cp ../property_portfolio.json src/data/portfolio.json${NC}"
echo ""
echo "  3. Start the dev server:"
echo -e "     ${BLUE}npm run dev${NC}"
echo ""
echo "  4. Open http://localhost:5173"
echo ""