# Property Risk Analytics Dashboard - Complete Context Summary

## Project Overview

**Application Name**: PropertyIntel Dashboard (part of ElevateNow platform)

**Purpose**: A geospatial property intelligence platform for commercial insurance portfolio analysis featuring:
- Interactive map visualization of insured properties
- Natural language search with keyword parsing AND AI Agent integration
- Property detail panels with Street View integration
- Risk control recommendations and alerts
- **AI-powered search with RAG knowledge base (FULLY INTEGRATED)**

**Tech Stack**:
- Frontend: React + TypeScript + Vite
- Mapping: Mapbox GL JS (dark theme)
- Street/Satellite View: Google Maps Embed API
- Styling: Inline CSS (dark theme, Inter font)
- AI Agent: Custom agent with RAG on "Property Risk Intelligence" knowledge base

---

## File/Folder Structure

```
~/appdev/propertyIntel/dashboard/
├── .env                          # API keys
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   └── elevatenowlogo.png        # ElevateNow logo (white version for dark theme)
├── src/
│   ├── App.tsx                   # Main application component (CORE FILE - ~1330 lines)
│   ├── main.tsx                  # React entry point
│   ├── data/
│   │   └── portfolio.json        # Property location data (20 locations)
│   └── index.css                 # Global styles (includes mapbox-gl CSS import)
```

---

## Environment Variables (.env)

```
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiZWxldmF0ZW5vdyIsImEiOiJjbWlqZDczejExNGJyM2NxODNtcjk4NXZzIn0.-boLEfnCFHAxHsD7XoazkA
VITE_GOOGLE_MAPS_KEY=AIzaSyAbw4ANv1qoB4UW4RM19tGNy1dSTu3QQug
VITE_ELEVATENOW_API_URL=https://api.elevatenow.ai
VITE_ELEVATENOW_API_KEY=
VITE_ENABLE_AI_AGENTS=true
VITE_ENABLE_STREET_VIEW=true
VITE_ENABLE_PERIL_OVERLAYS=true
```

---

## AI Agent Integration (COMPLETED)

### Agent API Configuration

```typescript
const AI_AGENT_URL = 'http://16.170.162.72:8004/query';
const AI_AGENT_ID = 'd7962a5a-2d8b-4b9f-94dc-90186347cf81';
```

### Request Format

```typescript
{
  agent_id: AI_AGENT_ID,
  message: JSON.stringify({
    query: "user's natural language question",
    portfolio: locations,           // Full portfolio array
    selected_location_id: "LOC-001" | null,
    current_filters: {}
  }),
  thread_id: randomNumber           // Generated per request
}
```

### Response Format

The API returns:
```json
{
  "response": "{\"intent\":\"filter\",\"response_text\":\"Found 1 property...\",\"actions\":[...],\"follow_up_suggestions\":[...]}"
}
```

Note: The `response` field contains stringified JSON that must be parsed.

### Parsed Response Structure

```typescript
{
  intent: "filter" | "location_briefing" | "recommendation" | "portfolio_summary" | "explanation" | "comparison" | "anomaly",
  response_text: "Natural language response from agent",
  actions: [
    { type: "filter_locations", location_ids: ["LOC-014"] },
    { type: "zoom_map", bounds: { north, south, east, west } },
    { type: "select_location", location_id: "LOC-001" },
    { type: "clear_filters" },
    { type: "highlight_locations", location_ids: [...], style: "alert" | "emphasis" }
  ],
  follow_up_suggestions: [
    "What are the hurricane risks here?",
    "Show me other Florida properties"
  ]
}
```

### Dashboard Action Processor

```typescript
const processAgentResponse = (agentResponse: any, allLocations: Location[]) => {
  // Parse stringified JSON from response field
  let result;
  if (agentResponse.response) {
    result = JSON.parse(agentResponse.response);
  } else if (agentResponse.metadata) {
    result = agentResponse.metadata;
  } else {
    result = agentResponse;
  }
  
  // Process actions and return dashboard updates
  return {
    filteredLocations,
    selectedLocation,
    interpretation: `🤖 ${responseText}`,
    mapBounds,
    suggestions
  };
};
```

---

## RAG Knowledge Base: "Property Risk Intelligence"

### Location
Deployed to AI Agent Studio with knowledge base name: **Property Risk Intelligence**

### Documents (8 files, 79KB total)

| Document | Size | Purpose |
|----------|------|---------|
| `risk_control_construction.md` | 7KB | Recommendations by ISO construction class (1-6) |
| `risk_control_perils.md` | 10KB | Recommendations by peril type with score interpretation |
| `risk_control_occupancy.md` | 14KB | Recommendations by occupancy (office, retail, manufacturing, etc.) |
| `geographic_risk_profiles.md` | 12KB | Regional intelligence for FL, CA, TX, NY, IL, MA, WA |
| `cope_reference_guide.md` | 11KB | Complete COPE framework and scoring |
| `underwriting_guidelines.md` | 8KB | Appetite, TIV limits, requirements |
| `claims_patterns_insights.md` | 10KB | Frequency/severity analysis, loss control |
| `portfolio_analysis_framework.md` | 7KB | Executive summary templates, concentration analysis |

### Agent Capabilities with RAG

1. **Risk Recommendations**: "What should we recommend for this location?" → Uses construction + perils + occupancy docs
2. **Location Briefing**: "Tell me about this property" → Synthesizes COPE + geographic + perils
3. **Portfolio Summary**: "Summarize Florida exposure" → Uses geographic + portfolio framework
4. **Underwriting Questions**: "Is this within appetite?" → References underwriting guidelines
5. **Claims Insight**: "What drives claims at retail locations?" → Retrieves from claims patterns
6. **Education**: "Explain earthquake risk in California" → Combines geographic + perils docs

---

## Core Files Detail

### App.tsx (Main Component - ~1330 lines)

**Key Features Implemented**:

1. **Header Section** (60px height):
   - Left: ElevateNow logo
   - Center: Smart search bar with magic wand toggle
   - Right: User profile dropdown (VS / Administrator)

2. **Smart Search Bar**:
   - Google-style natural language input
   - Rotating placeholder examples (10 queries, 4-second rotation)
   - "Try asking..." dropdown on focus (6 examples)
   - **Magic Wand Toggle (🪄)**:
     - OFF (default): Fast keyword search, blue "Search" button
     - ON: Purple glow, "✨ Ask AI" button, calls Agent API
   - Clear (×) button when query exists

3. **AI Response Accordion** (NEW):
   - Collapsible display for AI responses
   - Purple "AI Insight" button with ▶ toggle arrow
   - Expanded: Full response in styled card with dark background
   - Collapsed: Truncated preview (100 chars)
   - × button to dismiss
   - Smooth fade-in animation
   - Keyword search still shows inline (no accordion)

4. **KPI Tiles** (5 metrics):
   - Locations (blue)
   - Total TIV (green)
   - Avg TIV (cyan)
   - Claims + Incurred (orange)
   - Alerts (yellow, or gray if zero)

5. **Map View**:
   - Mapbox dark theme (dark-v11)
   - Color-coded markers by TIV range
   - Yellow glow border on markers with alerts
   - Auto-zoom to filtered results (single: zoom 14, multiple: fit bounds)
   - Legend (TIV ranges + alert indicator)
   - Count badge ("X of Y" when filtered)

6. **Detail Panel** (460px, right side):
   - Google Maps embed (Street View default, Satellite toggle)
   - Address overlay with gradient
   - Metrics grid: TIV, Year Built, Construction, Protection
   - CAT Hazards grid (6 perils with color-coded scores)
   - Claims History
   - Risk Alert card (if has_recommendations = 'Y')

**State Variables**:
```typescript
locations           // Full portfolio data
filtered            // Currently filtered locations
selected            // Currently selected location for detail panel
query               // Search input value
searching           // Loading state
mapReady            // Map initialization complete
showUserMenu        // User dropdown visibility
hoveredKpi          // KPI hover state
viewMode            // 'street' | 'satellite'
activeFilters       // Array of applied filter pills
interpretation      // Search result interpretation text
placeholderIndex    // Rotating placeholder index
showExamples        // Example dropdown visibility
aiMode              // Magic wand toggle state (false = keyword, true = AI)
aiResponseExpanded  // Accordion expanded state (NEW)
```

**Key Functions**:

- `parseQuery()`: Keyword-based NLP parser (50+ patterns)
  - Handles: states, cities, perils, TIV, construction, age, sprinklers, occupancy, claims, alerts
  - Returns: `{ locations, filters, interpretation }`

- `processAgentResponse()`: Parses Agent API response and extracts actions

- `handleSearch()`: Routes to keyword search or AI mode based on `aiMode` state
  - AI Mode: Calls Agent API, processes response, executes actions
  - Fallback: Uses keyword search if API fails

- `zoomToLocations()`: Auto-fits map bounds to filtered results

- `getMapUrl()`: Generates Google Maps Embed URL (street or satellite)

---

## Search Modes

### Mode 1: Keyword Search (Default - Wand OFF)

**Behavior**:
- Fast local parsing (~300ms)
- 50+ keyword patterns supported
- Filter pills appear in feedback bar
- Blue theme

**Supported Queries**:
- Location: "florida", "new york", "times square", "chicago"
- Perils: "hurricane", "earthquake", "flood", "wildfire", "tornado", "surge", "terrorism"
- Value: "high value", "large", "over 50M", "small"
- Protection: "sprinklered", "not sprinklered", "unprotected"
- Construction: "fire resistive", "frame", "masonry"
- Age: "old buildings", "pre-1980", "new", "modern"
- Status: "alerts", "recommendations", "needs attention"
- Claims: "high claims", "no claims", "loss history"
- Occupancy: "office", "retail", "high rise", "warehouse"
- Combined: "florida hurricane risk", "old buildings with alerts"

### Mode 2: AI Search (Wand ON)

**Behavior**:
- Calls Agent API with full portfolio context
- Agent uses RAG knowledge base for intelligence
- Returns structured actions for dashboard
- Purple theme
- Collapsible accordion for response display
- Graceful fallback to keyword search on error

**Example Queries**:
- "Show me Florida properties with hurricane risk"
- "Tell me about the Empire State Building"
- "What risk control recommendations should we make for Miami?"
- "Give me an executive summary of this portfolio"
- "Which properties need attention?"
- "Compare earthquake risk between California and New York"

---

## Agent Instructions

The agent is configured with detailed instructions for:

1. **Input Processing**: Receives JSON with query, portfolio, selected location, current filters
2. **Intent Classification**: filter, location_briefing, recommendation, portfolio_summary, explanation, comparison, anomaly
3. **Action Generation**: filter_locations, zoom_map, select_location, clear_filters, highlight_locations
4. **Response Text**: Concise, professional, references actual portfolio data
5. **Follow-up Suggestions**: 2-4 relevant next questions

See `agent_instructions.md` for complete agent configuration.

---

## Design System

**Colors**:
- Background: #0a0a0f (near black)
- Cards: rgba(255,255,255,0.02-0.06)
- Borders: rgba(255,255,255,0.06-0.1)
- Text primary: white
- Text secondary: rgba(255,255,255,0.45-0.6)

**Accent Colors**:
- Blue (keyword search): #3b82f6, #60a5fa
- Green (TIV/good): #34d399, #22c55e
- Yellow (alerts): #fbbf24, #eab308
- Orange (claims): #fb923c, #f97316
- Red (high risk): #ef4444
- Cyan: #22d3ee
- Purple (AI mode): #8b5cf6, #6d28d9, #a78bfa

**Typography**:
- Font: Inter (system fallback)
- KPI values: 24px, weight 700
- Headers: 18px, weight 600
- Body: 13-14px
- Labels: 10-11px, uppercase, letter-spacing 0.05-0.06em

**Border Radius**:
- Large cards: 14px
- Buttons: 8-10px
- Small elements: 6px

---

## Portfolio Data (20 locations)

**Schema**:
```typescript
{
  location_id: string,
  address: string,
  city: string,
  state: string,
  lat: number,
  lon: number,
  total_tiv: number,
  construction_code: string,      // "1"-"6"
  year_built: number,
  sprinkler_status: string,
  occupancy_desc: string,
  hurricane: number,              // 1-10
  earthquake: number,             // 1-10
  flood_score: number,            // 1-10
  wildfire: number,               // 1-10
  tornado_hail: number,           // 1-10
  terrorism: number,              // 1-10
  surge_risk: number,             // 1-10
  total_claims: number,
  total_incurred: number,
  has_recommendations: string,    // "Y" or "N"
  rc_title: string,
  rc_text: string
}
```

**Locations by Region**:
- NYC (8): Empire State, WTC, Rockefeller, Chrysler, Times Square, MetLife, Brookfield
- California (3): Century City LA, Downtown LA, South Coast Plaza
- Chicago (2): Willis Tower, John Hancock
- Florida (1): 700 Brickell, Miami
- Texas (1): 600 Congress, Austin
- Other (5): Boston, Seattle, San Francisco, additional NYC

---

## Key Decisions Made

| Decision | Rationale | Implementation |
|----------|-----------|----------------|
| Magic wand toggle for AI | Clear user control, prevents accidental API calls | 🪄 button toggles `aiMode` state |
| Collapsible AI response | Prevent invasive text display | Accordion with expand/collapse |
| Glow effect on markers | Transform caused Mapbox position bug | box-shadow instead of scale |
| Street View default | Real addresses have excellent coverage | `viewMode` defaults to 'street' |
| Stringified JSON in API | Agent returns nested JSON | Parse `response.response` field |
| Fallback to keyword | Graceful degradation if API fails | try/catch with warning message |
| Purple theme for AI | Visual distinction between modes | Consistent purple (#8b5cf6) |

---

## Files Created/Available

| File | Location | Purpose |
|------|----------|---------|
| App.tsx | /mnt/user-data/outputs/ | Main dashboard component |
| portfolio.json | src/data/ | Property data (20 locations) |
| agent_instructions.md | /mnt/user-data/outputs/ | Agent configuration |
| rag_knowledge_base.zip | /mnt/user-data/outputs/ | 8 RAG documents |
| elevatenowlogo.png | public/ | Logo |

---

## Testing the Integration

### Simple Test Query

With AI mode (🪄) enabled, type:
```
Show me Florida properties
```

**Expected Flow**:
1. Dashboard sends POST to `http://16.170.162.72:8004/query`
2. Agent returns filter for LOC-014 + zoom bounds for Miami
3. Dashboard filters map to show only 700 Brickell
4. Purple accordion shows AI response
5. KPIs update to filtered stats

### Other Test Queries

| Query | Expected Result |
|-------|-----------------|
| "Properties with alerts" | Filters to has_recommendations = Y |
| "Tell me about Empire State Building" | Selects LOC-001, opens detail |
| "High earthquake risk" | Filters to California properties |
| "Executive summary" | No filter, shows portfolio analysis |
| "What should we recommend for Miami?" | Detailed risk control recommendations |

---

## Next Steps / Future Enhancements

1. **Follow-up Suggestions UI**: Display clickable chips from `follow_up_suggestions`
2. **Conversation Threading**: Maintain context across queries using `thread_id`
3. **Agent Streaming**: Stream long responses for better UX
4. **Additional RAG Content**: Industry benchmarks, regulatory requirements
5. **Voice Input**: Speech-to-text for hands-free queries
6. **Export/Reports**: Generate PDF reports from AI summaries

---

## Additional Context

**User**: VS - Principal Technology & AI Transformation Consultant at Veritas Analytics LLC, co-founder of ElevateNow. Former VP at Travelers Insurance (16 years). Expert in commercial insurance, InsurTech, and AI transformation.

**Project Purpose**: Demo/MVP for ElevateNow platform showcasing AI-powered property risk analytics for insurance carriers.

**Agent Platform**: Custom agent deployed at `http://16.170.162.72:8004` with "Property Risk Intelligence" RAG knowledge base.