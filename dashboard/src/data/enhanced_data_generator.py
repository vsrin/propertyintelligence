#!/usr/bin/env python3
"""
Enhanced Property Risk Portfolio - Synthetic Data Generator
============================================================
Account-centric generator with geographic clustering for MDM demonstration.
Creates realistic multi-location accounts with parent-child relationships.

Author: ElevateNow
Version: 2.0
"""

import json
import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class GeneratorConfig:
    """Configuration for the enhanced data generator"""
    seed: Optional[int] = 42
    output_file: str = "portfolio.json"
    
    # Account distribution
    num_accounts: int = 15
    min_locations_per_account: int = 15
    max_locations_per_account: int = 80
    
    # Data quality settings (for MDM demonstration)
    pct_missing_coordinates: float = 0.08
    pct_missing_construction: float = 0.12
    pct_missing_sqft: float = 0.15
    pct_stale_inspection: float = 0.10
    pct_data_conflicts: float = 0.05

# =============================================================================
# ACCOUNT TEMPLATES - Real-world inspired multi-location businesses
# =============================================================================

ACCOUNT_TEMPLATES = [
    {
        "type": "university",
        "name_patterns": ["{City} State University", "{City} College", "University of {State}", 
                         "{Name} Institute of Technology", "{Name} Community College"],
        "location_range": (35, 80),
        "tiv_range": (500_000, 15_000_000),
        "cluster_radius_miles": 0.8,
        "satellite_pct": 0.15,
        "naics": "611310",
        "sic": "8221",
        "occupancy_types": ["Schools-Colleges, Univ.", "Schools-Dormitory", "Office - General", 
                           "Warehouse/Storage", "Athletic Facility", "Library/Museum"],
        "construction_bias": ["Frame", "Joisted Masonry", "Masonry Non-Combustible"],
    },
    {
        "type": "healthcare_system",
        "name_patterns": ["{City} Regional Medical Center", "{Name} Health System", 
                         "{City} Memorial Hospital", "St. {Name} Healthcare"],
        "location_range": (25, 55),
        "tiv_range": (2_000_000, 85_000_000),
        "cluster_radius_miles": 1.5,
        "satellite_pct": 0.30,
        "naics": "622110",
        "sic": "8062",
        "occupancy_types": ["Hospital", "Medical Office", "Clinic", "Urgent Care", 
                           "Pharmacy", "Laboratory", "Office - General"],
        "construction_bias": ["Masonry Non-Combustible", "Fire Resistive", "Non-Combustible"],
    },
    {
        "type": "retail_chain",
        "name_patterns": ["{Name} Retail Group", "{Name} Stores Inc.", "{Name} Shopping Centers",
                         "{Name} Properties LLC"],
        "location_range": (40, 100),
        "tiv_range": (800_000, 25_000_000),
        "cluster_radius_miles": 0,  # Scattered nationally
        "satellite_pct": 1.0,
        "naics": "452910",
        "sic": "5311",
        "occupancy_types": ["Mercantile/Retail", "Shopping Center", "Strip Mall", 
                           "Warehouse/Distribution"],
        "construction_bias": ["Masonry Non-Combustible", "Non-Combustible", "Joisted Masonry"],
    },
    {
        "type": "industrial",
        "name_patterns": ["{Name} Manufacturing Corp.", "{Name} Industries LLC", 
                         "{City} Industrial Partners", "Precision {Name} Inc."],
        "location_range": (20, 50),
        "tiv_range": (3_000_000, 120_000_000),
        "cluster_radius_miles": 2.0,
        "satellite_pct": 0.40,
        "naics": "332710",
        "sic": "3599",
        "occupancy_types": ["Manufacturing/Industrial", "Warehouse/Distribution", 
                           "Office - General", "Research Facility"],
        "construction_bias": ["Non-Combustible", "Masonry Non-Combustible", "Fire Resistive"],
    },
    {
        "type": "office_reit",
        "name_patterns": ["{Name} Office Trust", "{City} Property Group", 
                         "{Name} Real Estate Partners", "Premier {Name} Properties"],
        "location_range": (30, 70),
        "tiv_range": (5_000_000, 200_000_000),
        "cluster_radius_miles": 0,  # Major metros
        "satellite_pct": 1.0,
        "naics": "531120",
        "sic": "6512",
        "occupancy_types": ["Office - High Rise", "Office - Mid Rise", "Office - Low Rise",
                           "Mixed Use", "Parking Structure"],
        "construction_bias": ["Fire Resistive", "Modified Fire Resistive", "Masonry Non-Combustible"],
    },
    {
        "type": "hotel_chain",
        "name_patterns": ["{Name} Hotels & Resorts", "{Name} Hospitality Group",
                         "{Name} Inn Properties", "Coastal {Name} Hotels"],
        "location_range": (20, 45),
        "tiv_range": (8_000_000, 95_000_000),
        "cluster_radius_miles": 0,
        "satellite_pct": 1.0,
        "naics": "721110",
        "sic": "7011",
        "occupancy_types": ["Hotel/Motel", "Resort", "Convention Center", "Restaurant"],
        "construction_bias": ["Fire Resistive", "Masonry Non-Combustible", "Non-Combustible"],
    },
    {
        "type": "school_district",
        "name_patterns": ["{City} Unified School District", "{County} Public Schools",
                         "{City} Independent School District"],
        "location_range": (25, 60),
        "tiv_range": (1_000_000, 35_000_000),
        "cluster_radius_miles": 5.0,
        "satellite_pct": 0.10,
        "naics": "611110",
        "sic": "8211",
        "occupancy_types": ["School - K-12", "School - Administration", "Athletic Facility",
                           "Maintenance Facility", "Bus Depot"],
        "construction_bias": ["Joisted Masonry", "Masonry Non-Combustible", "Frame"],
    },
    {
        "type": "restaurant_franchise",
        "name_patterns": ["{Name} Restaurant Group", "{Name} Dining Enterprises",
                         "{Name} Food Services LLC"],
        "location_range": (35, 80),
        "tiv_range": (400_000, 4_000_000),
        "cluster_radius_miles": 0,
        "satellite_pct": 1.0,
        "naics": "722511",
        "sic": "5812",
        "occupancy_types": ["Restaurant", "Fast Food", "Bar/Tavern"],
        "construction_bias": ["Joisted Masonry", "Frame", "Masonry Non-Combustible"],
    },
    {
        "type": "logistics",
        "name_patterns": ["{Name} Logistics Inc.", "{Name} Distribution Centers",
                         "{City} Supply Chain Partners", "Express {Name} Warehousing"],
        "location_range": (15, 40),
        "tiv_range": (10_000_000, 150_000_000),
        "cluster_radius_miles": 0,
        "satellite_pct": 1.0,
        "naics": "493110",
        "sic": "4225",
        "occupancy_types": ["Warehouse/Distribution", "Cold Storage", "Office - General",
                           "Truck Terminal"],
        "construction_bias": ["Non-Combustible", "Masonry Non-Combustible"],
    },
    {
        "type": "municipal",
        "name_patterns": ["City of {City}", "{City} Municipal Authority",
                         "{County} County Government"],
        "location_range": (30, 70),
        "tiv_range": (500_000, 45_000_000),
        "cluster_radius_miles": 3.0,
        "satellite_pct": 0.20,
        "naics": "921110",
        "sic": "9111",
        "occupancy_types": ["Government Office", "Fire Station", "Police Station", 
                           "Library/Museum", "Community Center", "Maintenance Facility"],
        "construction_bias": ["Masonry Non-Combustible", "Joisted Masonry", "Fire Resistive"],
    },
]

# =============================================================================
# GEOGRAPHIC DATA - Major metro areas with precise coordinates
# =============================================================================

METRO_AREAS = {
    # Northeast
    "New York": {"lat": 40.7128, "lon": -74.0060, "state": "NY", "region": "Northeast"},
    "Manhattan": {"lat": 40.7831, "lon": -73.9712, "state": "NY", "region": "Northeast"},
    "Brooklyn": {"lat": 40.6782, "lon": -73.9442, "state": "NY", "region": "Northeast"},
    "Boston": {"lat": 42.3601, "lon": -71.0589, "state": "MA", "region": "Northeast"},
    "Philadelphia": {"lat": 39.9526, "lon": -75.1652, "state": "PA", "region": "Northeast"},
    "Hartford": {"lat": 41.7658, "lon": -72.6734, "state": "CT", "region": "Northeast"},
    "Newark": {"lat": 40.7357, "lon": -74.1724, "state": "NJ", "region": "Northeast"},
    
    # Southeast
    "Miami": {"lat": 25.7617, "lon": -80.1918, "state": "FL", "region": "Southeast"},
    "Fort Lauderdale": {"lat": 26.1224, "lon": -80.1373, "state": "FL", "region": "Southeast"},
    "Tampa": {"lat": 27.9506, "lon": -82.4572, "state": "FL", "region": "Southeast"},
    "Orlando": {"lat": 28.5383, "lon": -81.3792, "state": "FL", "region": "Southeast"},
    "Jacksonville": {"lat": 30.3322, "lon": -81.6557, "state": "FL", "region": "Southeast"},
    "Atlanta": {"lat": 33.7490, "lon": -84.3880, "state": "GA", "region": "Southeast"},
    "Charlotte": {"lat": 35.2271, "lon": -80.8431, "state": "NC", "region": "Southeast"},
    "Raleigh": {"lat": 35.7796, "lon": -78.6382, "state": "NC", "region": "Southeast"},
    "Nashville": {"lat": 36.1627, "lon": -86.7816, "state": "TN", "region": "Southeast"},
    
    # Midwest
    "Chicago": {"lat": 41.8781, "lon": -87.6298, "state": "IL", "region": "Midwest"},
    "Detroit": {"lat": 42.3314, "lon": -83.0458, "state": "MI", "region": "Midwest"},
    "Minneapolis": {"lat": 44.9778, "lon": -93.2650, "state": "MN", "region": "Midwest"},
    "Columbus": {"lat": 39.9612, "lon": -82.9988, "state": "OH", "region": "Midwest"},
    "Cleveland": {"lat": 41.4993, "lon": -81.6944, "state": "OH", "region": "Midwest"},
    "Indianapolis": {"lat": 39.7684, "lon": -86.1581, "state": "IN", "region": "Midwest"},
    "Milwaukee": {"lat": 43.0389, "lon": -87.9065, "state": "WI", "region": "Midwest"},
    "Kansas City": {"lat": 39.0997, "lon": -94.5786, "state": "MO", "region": "Midwest"},
    "St. Louis": {"lat": 38.6270, "lon": -90.1994, "state": "MO", "region": "Midwest"},
    
    # Southwest/West
    "Los Angeles": {"lat": 34.0522, "lon": -118.2437, "state": "CA", "region": "West"},
    "San Francisco": {"lat": 37.7749, "lon": -122.4194, "state": "CA", "region": "West"},
    "San Diego": {"lat": 32.7157, "lon": -117.1611, "state": "CA", "region": "West"},
    "San Jose": {"lat": 37.3382, "lon": -121.8863, "state": "CA", "region": "West"},
    "Sacramento": {"lat": 38.5816, "lon": -121.4944, "state": "CA", "region": "West"},
    "Phoenix": {"lat": 33.4484, "lon": -112.0740, "state": "AZ", "region": "West"},
    "Las Vegas": {"lat": 36.1699, "lon": -115.1398, "state": "NV", "region": "West"},
    "Denver": {"lat": 39.7392, "lon": -104.9903, "state": "CO", "region": "West"},
    "Seattle": {"lat": 47.6062, "lon": -122.3321, "state": "WA", "region": "West"},
    "Portland": {"lat": 45.5152, "lon": -122.6784, "state": "OR", "region": "West"},
    
    # Texas
    "Houston": {"lat": 29.7604, "lon": -95.3698, "state": "TX", "region": "Southwest"},
    "Dallas": {"lat": 32.7767, "lon": -96.7970, "state": "TX", "region": "Southwest"},
    "San Antonio": {"lat": 29.4241, "lon": -98.4936, "state": "TX", "region": "Southwest"},
    "Austin": {"lat": 30.2672, "lon": -97.7431, "state": "TX", "region": "Southwest"},
    "Fort Worth": {"lat": 32.7555, "lon": -97.3308, "state": "TX", "region": "Southwest"},
    
    # Tornado Alley
    "Oklahoma City": {"lat": 35.4676, "lon": -97.5164, "state": "OK", "region": "Central"},
    "Tulsa": {"lat": 36.1540, "lon": -95.9928, "state": "OK", "region": "Central"},
    "Wichita": {"lat": 37.6872, "lon": -97.3301, "state": "KS", "region": "Central"},
    "Omaha": {"lat": 41.2565, "lon": -95.9345, "state": "NE", "region": "Central"},
    "Little Rock": {"lat": 34.7465, "lon": -92.2896, "state": "AR", "region": "Central"},
}

# Smaller cities for variety
SECONDARY_CITIES = {
    "Banner Elk": {"lat": 36.1626, "lon": -81.8717, "state": "NC", "region": "Southeast"},
    "Asheville": {"lat": 35.5951, "lon": -82.5515, "state": "NC", "region": "Southeast"},
    "Savannah": {"lat": 32.0809, "lon": -81.0912, "state": "GA", "region": "Southeast"},
    "Charleston": {"lat": 32.7765, "lon": -79.9311, "state": "SC", "region": "Southeast"},
    "Boulder": {"lat": 40.0150, "lon": -105.2705, "state": "CO", "region": "West"},
    "Santa Fe": {"lat": 35.6870, "lon": -105.9378, "state": "NM", "region": "West"},
    "Boise": {"lat": 43.6150, "lon": -116.2023, "state": "ID", "region": "West"},
    "Salt Lake City": {"lat": 40.7608, "lon": -111.8910, "state": "UT", "region": "West"},
    "Burlington": {"lat": 44.4759, "lon": -73.2121, "state": "VT", "region": "Northeast"},
    "Portland ME": {"lat": 43.6591, "lon": -70.2568, "state": "ME", "region": "Northeast"},
    "Providence": {"lat": 41.8240, "lon": -71.4128, "state": "RI", "region": "Northeast"},
    "Albany": {"lat": 42.6526, "lon": -73.7562, "state": "NY", "region": "Northeast"},
    "Syracuse": {"lat": 43.0481, "lon": -76.1474, "state": "NY", "region": "Northeast"},
    "Buffalo": {"lat": 42.8864, "lon": -78.8784, "state": "NY", "region": "Northeast"},
    "Rochester": {"lat": 43.1566, "lon": -77.6088, "state": "NY", "region": "Northeast"},
    "Grand Rapids": {"lat": 42.9634, "lon": -85.6681, "state": "MI", "region": "Midwest"},
    "Des Moines": {"lat": 41.5868, "lon": -93.6250, "state": "IA", "region": "Midwest"},
    "Madison": {"lat": 43.0731, "lon": -89.4012, "state": "WI", "region": "Midwest"},
    "Lexington": {"lat": 38.0406, "lon": -84.5037, "state": "KY", "region": "Southeast"},
    "Louisville": {"lat": 38.2527, "lon": -85.7585, "state": "KY", "region": "Southeast"},
    "Birmingham": {"lat": 33.5207, "lon": -86.8025, "state": "AL", "region": "Southeast"},
    "Mobile": {"lat": 30.6954, "lon": -88.0399, "state": "AL", "region": "Southeast"},
    "New Orleans": {"lat": 29.9511, "lon": -90.0715, "state": "LA", "region": "Southeast"},
    "Baton Rouge": {"lat": 30.4515, "lon": -91.1871, "state": "LA", "region": "Southeast"},
    "Memphis": {"lat": 35.1495, "lon": -90.0490, "state": "TN", "region": "Southeast"},
    "Knoxville": {"lat": 35.9606, "lon": -83.9207, "state": "TN", "region": "Southeast"},
    "Richmond": {"lat": 37.5407, "lon": -77.4360, "state": "VA", "region": "Southeast"},
    "Norfolk": {"lat": 36.8508, "lon": -76.2859, "state": "VA", "region": "Southeast"},
    "Tucson": {"lat": 32.2226, "lon": -110.9747, "state": "AZ", "region": "West"},
    "Albuquerque": {"lat": 35.0844, "lon": -106.6504, "state": "NM", "region": "West"},
    "Fresno": {"lat": 36.7378, "lon": -119.7871, "state": "CA", "region": "West"},
    "Oakland": {"lat": 37.8044, "lon": -122.2712, "state": "CA", "region": "West"},
    "Long Beach": {"lat": 33.7701, "lon": -118.1937, "state": "CA", "region": "West"},
    "Irvine": {"lat": 33.6846, "lon": -117.8265, "state": "CA", "region": "West"},
}

ALL_CITIES = {**METRO_AREAS, **SECONDARY_CITIES}

# =============================================================================
# REFERENCE DATA
# =============================================================================

CONSTRUCTION_TYPES = {
    "1": {"name": "Frame", "fire_risk": "high", "age_bias": "old"},
    "2": {"name": "Joisted Masonry", "fire_risk": "medium-high", "age_bias": "old"},
    "3": {"name": "Non-Combustible", "fire_risk": "medium", "age_bias": "any"},
    "4": {"name": "Masonry Non-Combustible", "fire_risk": "medium-low", "age_bias": "any"},
    "5": {"name": "Modified Fire Resistive", "fire_risk": "low", "age_bias": "new"},
    "6": {"name": "Fire Resistive", "fire_risk": "very-low", "age_bias": "new"},
}

ROOF_TYPES = ["Metal", "Built-Up", "Single Ply Membrane", "Asphalt Shingle", 
              "Wood Shake/Shingles", "Tile", "Slate", "EPDM"]

ROOF_SHAPES = ["Flat", "Gable", "Hip", "Mansard", "Shed", "IRR/CATHEDRAL"]

FIRE_PROTECTION_CLASSES = ["P1", "P2", "P3", "P4", "P5", "PP1", "PP2", "PP3", "PP4"]

HYDRANT_DISTANCES = ["< 250 Feet", "> 250 feet AND <= 500 feet", 
                     "> 500 feet AND <= 1,000 feet", "> 1,000 feet",
                     "Not yet covered in HydrantHub"]

COAST_DISTANCES = ["< 1 mile", "1-5 miles", "5-25 miles", "25-100 miles", "> 100 miles"]

BROKER_FIRMS = [
    {"name": "Marsh McLennan", "city": "New York", "state": "NY"},
    {"name": "Aon", "city": "Chicago", "state": "IL"},
    {"name": "Willis Towers Watson", "city": "London", "state": "UK"},
    {"name": "Gallagher", "city": "Rolling Meadows", "state": "IL"},
    {"name": "Brown & Brown", "city": "Daytona Beach", "state": "FL"},
    {"name": "Hub International", "city": "Chicago", "state": "IL"},
    {"name": "USI Insurance Services", "city": "Valhalla", "state": "NY"},
    {"name": "Lockton Companies", "city": "Kansas City", "state": "MO"},
    {"name": "Alliant Insurance Services", "city": "Newport Beach", "state": "CA"},
    {"name": "AssuredPartners", "city": "Lake Mary", "state": "FL"},
]

EXISTING_CARRIERS = ["Travelers", "Liberty Mutual", "Chubb", "Hartford", "CNA", 
                     "Zurich", "AIG", "FM Global", "Tokio Marine", "Allianz"]

NAME_PARTS = ["Summit", "Pacific", "Atlantic", "National", "American", "United",
              "Premier", "Pinnacle", "Horizon", "Gateway", "Legacy", "Heritage",
              "Patriot", "Liberty", "Freedom", "Golden", "Silver", "Metro",
              "Continental", "Global", "Central", "Northern", "Southern", "Western", "Eastern"]

RISK_CONTROL_RECOMMENDATIONS = [
    {
        "category": "Fire Protection",
        "title": "Automatic Sprinkler System Maintenance",
        "text": "The automatic sprinkler system should be inspected, tested, and maintained in accordance with NFPA 25. This includes quarterly main drain tests, monthly valve inspections, and annual internal inspections."
    },
    {
        "category": "Fire Protection", 
        "title": "Portable Fire Extinguisher Program",
        "text": "Ensure portable fire extinguishers are properly located, inspected monthly, and serviced annually. Train employees on proper extinguisher use and selection."
    },
    {
        "category": "Premises Safety",
        "title": "Slip, Trip, and Fall Prevention",
        "text": "Implement a comprehensive slip, trip, and fall prevention program including regular inspection of walking surfaces, immediate cleanup of spills, and proper lighting in all areas."
    },
    {
        "category": "Electrical Safety",
        "title": "Electrical System Inspection",
        "text": "Conduct a comprehensive inspection of the electrical system by a qualified electrician. Address any code violations and upgrade outdated wiring."
    },
    {
        "category": "Emergency Preparedness",
        "title": "Emergency Action Plan",
        "text": "Develop and implement a comprehensive emergency action plan including procedures for fire, severe weather, and medical emergencies. Conduct regular drills."
    },
    {
        "category": "Equipment Safety",
        "title": "Equipment Maintenance Program",
        "text": "Establish a preventive maintenance program for all building equipment including HVAC systems, elevators, and electrical systems. Maintain documentation of all inspections."
    },
    {
        "category": "Security",
        "title": "Physical Security Assessment",
        "text": "Conduct a comprehensive physical security assessment. Consider improvements to access control, surveillance systems, lighting, and perimeter security."
    },
    {
        "category": "Roof Maintenance",
        "title": "Roof Inspection and Maintenance",
        "text": "Implement annual roof inspections with immediate repair of any identified deficiencies. Document all inspections and maintain a roof maintenance log."
    },
]

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_uuid() -> str:
    """Generate a location ID similar to the sample data format"""
    hex_chars = '0123456789ABCDEF'
    return 'LUS' + ''.join(random.choice(hex_chars) for _ in range(17))

def miles_to_degrees(miles: float) -> float:
    """Convert miles to approximate degrees (rough estimate)"""
    return miles / 69.0

def generate_clustered_coords(center_lat: float, center_lon: float, 
                              radius_miles: float, count: int) -> List[Tuple[float, float]]:
    """Generate coordinates clustered around a center point"""
    coords = []
    for _ in range(count):
        # Use normal distribution for more realistic clustering
        angle = random.uniform(0, 2 * math.pi)
        # Most points closer to center
        distance = abs(random.gauss(0, radius_miles / 2))
        distance = min(distance, radius_miles)  # Cap at radius
        
        lat_offset = miles_to_degrees(distance * math.cos(angle))
        lon_offset = miles_to_degrees(distance * math.sin(angle)) / math.cos(math.radians(center_lat))
        
        new_lat = round(center_lat + lat_offset, 6)
        new_lon = round(center_lon + lon_offset, 6)
        coords.append((new_lat, new_lon))
    
    return coords

def score_to_grade(score: int) -> str:
    """Convert numeric score (1-10) to letter grade"""
    if score <= 2:
        return "A"
    elif score <= 4:
        return "B"
    elif score <= 6:
        return "C"
    elif score <= 8:
        return "D"
    else:
        return "F"

def get_peril_scores(state: str, lat: float, lon: float) -> Dict:
    """Generate correlated peril scores based on geography"""
    
    # Hurricane - Gulf/Atlantic coast
    hurricane_base = {
        "FL": 8, "LA": 9, "TX": 6, "NC": 7, "SC": 7, "GA": 5, 
        "AL": 6, "MS": 7, "VA": 4, "NJ": 4, "NY": 3
    }.get(state, 1)
    hurricane = max(1, min(10, hurricane_base + random.randint(-1, 1)))
    
    # Earthquake - West Coast and fault zones
    earthquake_base = {
        "CA": 8, "WA": 6, "OR": 5, "AK": 7, "NV": 4, "UT": 3, "MT": 2
    }.get(state, 1)
    earthquake = max(1, min(10, earthquake_base + random.randint(-1, 1)))
    
    # Tornado/Hail - Tornado Alley
    tornado_base = {
        "OK": 9, "KS": 9, "NE": 8, "TX": 7, "IA": 7, "MO": 6, 
        "AR": 6, "IL": 5, "IN": 5, "OH": 4, "AL": 5, "MS": 5
    }.get(state, 2)
    tornado = max(1, min(10, tornado_base + random.randint(-1, 1)))
    
    # Wildfire - Western states
    wildfire_base = {
        "CA": 8, "CO": 7, "AZ": 6, "NM": 6, "OR": 6, "WA": 5, 
        "MT": 5, "ID": 5, "NV": 4, "UT": 4, "TX": 3
    }.get(state, 1)
    wildfire = max(1, min(10, wildfire_base + random.randint(-1, 1)))
    
    # Flood - varies by location
    flood_base = random.choices([2, 4, 6, 8, 10], weights=[40, 25, 20, 10, 5])[0]
    flood = max(1, min(10, flood_base + random.randint(-1, 1)))
    
    # Flood zone based on score
    if flood <= 2:
        flood_zone, flood_desc = "X", "Minimal"
    elif flood <= 4:
        flood_zone, flood_desc = "X500", "Low"
    elif flood <= 6:
        flood_zone, flood_desc = "A", "Moderate"
    elif flood <= 8:
        flood_zone, flood_desc = "AE", "High"
    else:
        flood_zone, flood_desc = "VE", "Very High"
    
    # Storm surge - coastal correlation
    surge = 0
    if state in ["FL", "TX", "LA", "NC", "SC", "GA", "AL", "MS"] and hurricane >= 5:
        surge = random.randint(4, 9)
    
    # Terrorism - major metros
    terrorism_base = {"NY": 7, "CA": 5, "IL": 5, "TX": 4, "FL": 4, "DC": 8}.get(state, 2)
    terrorism = max(1, min(10, terrorism_base + random.randint(-1, 1)))
    
    return {
        "hurricane": hurricane,
        "hurricane_grade": score_to_grade(hurricane),
        "earthquake": earthquake,
        "earthquake_grade": score_to_grade(earthquake),
        "tornado_hail": tornado,
        "tornado_grade": score_to_grade(tornado),
        "hail_grade": score_to_grade(max(1, tornado - 1)),
        "wildfire": wildfire,
        "wildfire_grade": score_to_grade(wildfire),
        "wildfire_desc": ["None/Very Low", "Low", "Moderate", "High", "Very High"][min(4, wildfire // 2)],
        "flood_score": flood,
        "flood_grade": score_to_grade(flood),
        "flood_zone": flood_zone,
        "flood_desc": flood_desc,
        "surge_risk": surge,
        "terrorism": terrorism,
        "wind_grade": score_to_grade(max(hurricane, tornado)),
    }

def generate_street_address() -> str:
    """Generate a realistic street address"""
    number = random.randint(100, 15000)
    prefixes = ["", "North ", "South ", "East ", "West "]
    streets = ["Main", "Oak", "Maple", "Park", "Cedar", "Commerce", "Industrial",
               "Corporate", "Technology", "Gateway", "Enterprise", "Business",
               "Center", "Plaza", "Summit", "College", "University", "Hospital",
               "Medical", "Research", "Innovation", "Campus", "Memorial"]
    types = ["Street", "Avenue", "Boulevard", "Drive", "Road", "Way", "Parkway", 
             "Lane", "Circle", "Court", "Place"]
    
    return f"{number} {random.choice(prefixes)}{random.choice(streets)} {random.choice(types)}"

# =============================================================================
# MAIN GENERATOR CLASS
# =============================================================================

class EnhancedPropertyGenerator:
    """Account-centric property portfolio generator with MDM features"""
    
    def __init__(self, config: GeneratorConfig):
        self.config = config
        if config.seed:
            random.seed(config.seed)
        
        self.accounts = []
        self.locations = []
        self.location_counter = 0
    
    def generate_account(self, template: Dict) -> Dict:
        """Generate an account with firmographics"""
        
        # Pick a base city for headquarters
        if template["cluster_radius_miles"] > 0:
            # Campus-style: pick from secondary cities
            city_name = random.choice(list(SECONDARY_CITIES.keys()))
            city_data = SECONDARY_CITIES[city_name]
        else:
            # Scattered: pick from major metros for HQ
            city_name = random.choice(list(METRO_AREAS.keys()))
            city_data = METRO_AREAS[city_name]
        
        # Generate account name
        name_pattern = random.choice(template["name_patterns"])
        name_part = random.choice(NAME_PARTS)
        account_name = name_pattern.format(
            City=city_name.replace(" ", ""),
            State=city_data["state"],
            Name=name_part,
            County=city_name
        )
        
        # Revenue and employees based on location count
        num_locations = random.randint(*template["location_range"])
        base_revenue = random.uniform(10_000_000, 500_000_000)
        
        # Broker assignment
        broker = random.choice(BROKER_FIRMS)
        
        account_id = f"ACC-{random.randint(100000, 999999)}"
        
        account = {
            "account_id": account_id,
            "account_name": account_name,
            "account_type": template["type"],
            "hq_city": city_name,
            "hq_state": city_data["state"],
            "hq_lat": city_data["lat"],
            "hq_lon": city_data["lon"],
            "region": city_data["region"],
            "naics": template["naics"],
            "sic": template["sic"],
            "annual_revenue": round(base_revenue, 2),
            "employees": random.randint(50, 5000),
            "years_in_business": random.randint(5, 125),
            "broker_name": broker["name"],
            "broker_city": broker["city"],
            "broker_state": broker["state"],
            "existing_carriers": random.sample(EXISTING_CARRIERS, random.randint(1, 3)),
            "num_locations": num_locations,
            "template": template,
        }
        
        return account
    
    def generate_locations_for_account(self, account: Dict) -> List[Dict]:
        """Generate all locations for an account"""
        
        template = account["template"]
        num_locations = account["num_locations"]
        locations = []
        
        # Determine location distribution
        cluster_radius = template["cluster_radius_miles"]
        satellite_pct = template["satellite_pct"]
        
        if cluster_radius > 0:
            # Campus-style: most locations clustered, some satellites
            num_clustered = int(num_locations * (1 - satellite_pct))
            num_satellite = num_locations - num_clustered
            
            # Generate clustered coords
            clustered_coords = generate_clustered_coords(
                account["hq_lat"], account["hq_lon"],
                cluster_radius, num_clustered
            )
            
            # Generate satellite coords in nearby cities
            satellite_coords = []
            nearby_cities = [c for c, d in ALL_CITIES.items() 
                           if d["state"] == account["hq_state"] 
                           and c != account["hq_city"]]
            if not nearby_cities:
                nearby_cities = list(ALL_CITIES.keys())
            
            for _ in range(num_satellite):
                sat_city = random.choice(nearby_cities)
                sat_data = ALL_CITIES[sat_city]
                # Small cluster around satellite city
                sat_coords = generate_clustered_coords(
                    sat_data["lat"], sat_data["lon"], 1.0, 1
                )
                satellite_coords.extend(sat_coords)
            
            all_coords = clustered_coords + satellite_coords
        else:
            # Scattered nationally (retail, hotel chains)
            all_coords = []
            cities_used = random.sample(list(ALL_CITIES.keys()), 
                                       min(num_locations, len(ALL_CITIES)))
            
            for i in range(num_locations):
                city_name = cities_used[i % len(cities_used)]
                city_data = ALL_CITIES[city_name]
                # Small variation around city center
                coords = generate_clustered_coords(
                    city_data["lat"], city_data["lon"], 2.0, 1
                )
                all_coords.extend(coords)
        
        # Generate each location
        for i, (lat, lon) in enumerate(all_coords):
            location = self.generate_location(account, lat, lon, i)
            locations.append(location)
        
        # Set parent-child relationships for campus-style accounts
        if cluster_radius > 0 and len(locations) > 1:
            # First location is the "main" building
            main_building_id = locations[0]["location_id"]
            locations[0]["is_main_building"] = True
            locations[0]["building_name"] = "Main Campus / Administration"
            
            for loc in locations[1:]:
                loc["parent_location_id"] = main_building_id
                loc["is_main_building"] = False
        
        return locations
    
    def generate_location(self, account: Dict, lat: float, lon: float, index: int) -> Dict:
        """Generate a single location with full details"""
        
        self.location_counter += 1
        template = account["template"]
        
        # Find nearest city for address
        min_dist = float('inf')
        nearest_city = None
        nearest_state = account["hq_state"]
        
        for city_name, city_data in ALL_CITIES.items():
            dist = math.sqrt((lat - city_data["lat"])**2 + (lon - city_data["lon"])**2)
            if dist < min_dist:
                min_dist = dist
                nearest_city = city_name
                nearest_state = city_data["state"]
        
        # Generate TIV
        tiv_min, tiv_max = template["tiv_range"]
        total_tiv = round(random.uniform(tiv_min, tiv_max), 2)
        
        # TIV breakdown
        building_pct = random.uniform(0.50, 0.75)
        contents_pct = random.uniform(0.15, 0.35)
        bii_pct = max(0, 1 - building_pct - contents_pct)
        
        building_value = round(total_tiv * building_pct, 2)
        contents_value = round(total_tiv * contents_pct, 2)
        bii_value = round(total_tiv * bii_pct, 2)
        
        # Construction
        construction_bias = template.get("construction_bias", list(CONSTRUCTION_TYPES.values()))
        construction_name = random.choice(construction_bias)
        construction_code = next(
            (k for k, v in CONSTRUCTION_TYPES.items() if v["name"] == construction_name),
            "4"
        )
        
        # Year built
        if CONSTRUCTION_TYPES[construction_code]["age_bias"] == "old":
            year_built = random.randint(1920, 1985)
        elif CONSTRUCTION_TYPES[construction_code]["age_bias"] == "new":
            year_built = random.randint(1990, 2024)
        else:
            year_built = random.randint(1950, 2020)
        
        # Building characteristics
        occupancy = random.choice(template["occupancy_types"])
        
        if "High Rise" in occupancy:
            stories = random.randint(12, 55)
            sq_footage = random.randint(200_000, 1_500_000)
        elif "Mid Rise" in occupancy:
            stories = random.randint(5, 11)
            sq_footage = random.randint(50_000, 300_000)
        elif "Warehouse" in occupancy or "Industrial" in occupancy:
            stories = random.randint(1, 3)
            sq_footage = random.randint(50_000, 800_000)
        else:
            stories = random.randint(1, 4)
            sq_footage = random.randint(5_000, 100_000)
        
        # Sprinkler status - correlated with TIV and construction
        if total_tiv > 20_000_000 or construction_code in ["5", "6"]:
            sprinkler_status = random.choices(
                ["Y", "N", "Partial"],
                weights=[0.85, 0.05, 0.10]
            )[0]
        else:
            sprinkler_status = random.choices(
                ["Y", "N", "Partial"],
                weights=[0.55, 0.30, 0.15]
            )[0]
        
        # Protection class
        fire_protection_class = random.choice(FIRE_PROTECTION_CLASSES)
        
        # Peril scores
        perils = get_peril_scores(nearest_state, lat, lon)
        
        # Claims - correlated with risk
        risk_factor = (perils["hurricane"] + perils["earthquake"] + 
                       perils["flood_score"] + perils["tornado_hail"]) / 40
        
        if risk_factor > 0.6:
            total_claims = random.randint(3, 15)
            total_incurred = random.randint(50_000, 500_000)
        elif risk_factor > 0.3:
            total_claims = random.randint(0, 8)
            total_incurred = random.randint(10_000, 200_000)
        else:
            total_claims = random.randint(0, 3)
            total_incurred = random.randint(0, 50_000)
        
        # Risk control recommendations
        has_recommendations = random.random() < 0.25
        rc_data = {}
        if has_recommendations:
            rec = random.choice(RISK_CONTROL_RECOMMENDATIONS)
            rc_data = {
                "has_recommendations": "Y",
                "rc_category": rec["category"],
                "rc_title": rec["title"],
                "rc_text": rec["text"],
                "rc_job_number": f"RC-{random.randint(100000, 999999)}",
            }
        else:
            rc_data = {
                "has_recommendations": "N",
                "rc_category": "",
                "rc_title": "",
                "rc_text": "",
                "rc_job_number": "",
            }
        
        # Data quality simulation
        data_quality_issues = []
        
        # Missing coordinates (but we still have them for the map - they're just flagged)
        coords_missing = random.random() < self.config.pct_missing_coordinates
        if coords_missing:
            data_quality_issues.append("missing_coordinates")
        
        # Missing construction details
        construction_missing = random.random() < self.config.pct_missing_construction
        if construction_missing:
            data_quality_issues.append("missing_construction")
        
        # Missing square footage
        sqft_missing = random.random() < self.config.pct_missing_sqft
        if sqft_missing:
            data_quality_issues.append("missing_sqft")
            sq_footage = None
        
        # Stale inspection
        stale_inspection = random.random() < self.config.pct_stale_inspection
        if stale_inspection:
            data_quality_issues.append("stale_inspection")
            last_inspection = datetime.now() - timedelta(days=random.randint(1100, 2000))
        else:
            last_inspection = datetime.now() - timedelta(days=random.randint(30, 365))
        
        # Calculate data quality score
        data_quality_score = 100 - (len(data_quality_issues) * 15)
        
        # Generate building name for campus-style
        building_names = [
            "Building A", "Building B", "Building C", "North Wing", "South Wing",
            "East Building", "West Building", "Main Hall", "Science Center",
            "Student Center", "Administration", "Library", "Gymnasium", "Auditorium",
            "Research Lab", "Maintenance", "Storage Facility", "Parking Garage",
            "Medical Center", "Emergency Services", "Outpatient Clinic"
        ]
        building_name = random.choice(building_names) if template["cluster_radius_miles"] > 0 else ""
        
        # Available data counts (simulating linked records)
        available_data = {
            "iso_reports": random.randint(0, 5),
            "risk_control_reports": 1 if has_recommendations else 0,
            "claims_count": total_claims,
            "inspection_count": random.randint(0, 3),
            "nearmap_available": random.random() > 0.2,
        }
        
        location = {
            # Identity
            "location_id": generate_uuid(),
            "account_id": account["account_id"],
            "account_name": account["account_name"],
            "parent_location_id": None,
            "building_name": building_name,
            "is_main_building": False,
            
            # Address
            "address": generate_street_address(),
            "city": nearest_city,
            "state": nearest_state,
            "zip": str(random.randint(10000, 99999)),
            "county": f"{nearest_city} County",
            "lat": lat if not coords_missing else None,
            "lon": lon if not coords_missing else None,
            "lat_actual": lat,  # Always keep actual coords for map
            "lon_actual": lon,
            "region": ALL_CITIES.get(nearest_city, {}).get("region", "Unknown"),
            
            # COPE
            "construction_code": construction_code if not construction_missing else None,
            "construction_type": construction_name if not construction_missing else "Unknown",
            "year_built": year_built,
            "stories": stories,
            "sq_footage": sq_footage,
            "occupancy_desc": occupancy,
            "roof_type": random.choice(ROOF_TYPES),
            "roof_shape": random.choice(ROOF_SHAPES),
            
            # Protection
            "sprinkler_status": sprinkler_status,
            "fire_protection_class": fire_protection_class,
            "fire_hydrant_distance": random.choice(HYDRANT_DISTANCES),
            "coast_distance": random.choice(COAST_DISTANCES),
            
            # Exposure
            "building_value": building_value,
            "contents_value": contents_value,
            "bii_value": bii_value,
            "total_tiv": total_tiv,
            
            # Perils (numeric scores)
            "hurricane": perils["hurricane"],
            "earthquake": perils["earthquake"],
            "flood_score": perils["flood_score"],
            "wildfire": perils["wildfire"],
            "tornado_hail": perils["tornado_hail"],
            "surge_risk": perils["surge_risk"],
            "terrorism": perils["terrorism"],
            
            # Perils (letter grades - for ISO-style display)
            "hurricane_grade": perils["hurricane_grade"],
            "earthquake_grade": perils["earthquake_grade"],
            "flood_grade": perils["flood_grade"],
            "flood_zone": perils["flood_zone"],
            "wildfire_grade": perils["wildfire_grade"],
            "wildfire_desc": perils["wildfire_desc"],
            "tornado_grade": perils["tornado_grade"],
            "hail_grade": perils["hail_grade"],
            "wind_grade": perils["wind_grade"],
            
            # Claims
            "total_claims": total_claims,
            "total_incurred": total_incurred,
            "total_paid": round(total_incurred * random.uniform(0.6, 0.95), 2),
            "property_claims": random.randint(0, max(0, total_claims - 2)),
            "gl_claims": max(0, total_claims - random.randint(0, total_claims)),
            
            # Risk Control
            **rc_data,
            
            # Data Quality / MDM
            "data_quality_score": data_quality_score,
            "data_quality_issues": data_quality_issues,
            "last_inspection_date": last_inspection.strftime("%Y-%m-%d"),
            "source_system": random.choice(["Submission", "Policy Admin", "ISO", "Manual Entry"]),
            
            # Available linked data
            "available_data": available_data,
            
            # Policy info
            "named_insured": account["account_name"],
            "policy_number": f"PRP-{random.randint(1000000, 9999999)}",
            "business_unit": random.choice(["National Property", "Middle Market", "Select"]),
            "sic_code": account["sic"],
            "naics_code": account["naics"],
        }
        
        return location
    
    def generate_portfolio(self) -> Tuple[List[Dict], List[Dict]]:
        """Generate the full portfolio with accounts and locations"""
        
        print(f"Generating {self.config.num_accounts} accounts...")
        
        # Select account templates
        templates_to_use = random.sample(
            ACCOUNT_TEMPLATES, 
            min(self.config.num_accounts, len(ACCOUNT_TEMPLATES))
        )
        
        # If we need more accounts than templates, repeat some
        while len(templates_to_use) < self.config.num_accounts:
            templates_to_use.append(random.choice(ACCOUNT_TEMPLATES))
        
        for i, template in enumerate(templates_to_use):
            print(f"  [{i+1}/{self.config.num_accounts}] Generating {template['type']} account...")
            
            account = self.generate_account(template)
            self.accounts.append(account)
            
            locations = self.generate_locations_for_account(account)
            self.locations.extend(locations)
            
            print(f"    → {account['account_name']}: {len(locations)} locations")
        
        print(f"\nComplete! Generated {len(self.accounts)} accounts with {len(self.locations)} total locations.")
        
        return self.accounts, self.locations
    
    def get_summary(self) -> Dict:
        """Generate portfolio summary statistics"""
        
        total_tiv = sum(loc["total_tiv"] for loc in self.locations)
        total_claims = sum(loc["total_claims"] for loc in self.locations)
        
        # State distribution
        state_dist = {}
        for loc in self.locations:
            state = loc["state"]
            state_dist[state] = state_dist.get(state, 0) + 1
        
        # Account type distribution
        type_dist = {}
        for acc in self.accounts:
            acc_type = acc["account_type"]
            type_dist[acc_type] = type_dist.get(acc_type, 0) + 1
        
        # Data quality issues
        locations_with_issues = sum(1 for loc in self.locations if loc["data_quality_issues"])
        
        # Locations with alerts
        locations_with_alerts = sum(1 for loc in self.locations if loc["has_recommendations"] == "Y")
        
        return {
            "total_accounts": len(self.accounts),
            "total_locations": len(self.locations),
            "total_tiv": total_tiv,
            "avg_tiv": total_tiv / len(self.locations) if self.locations else 0,
            "avg_locations_per_account": len(self.locations) / len(self.accounts) if self.accounts else 0,
            "total_claims": total_claims,
            "states_represented": len(state_dist),
            "state_distribution": dict(sorted(state_dist.items(), key=lambda x: -x[1])[:15]),
            "account_type_distribution": type_dist,
            "locations_with_data_issues": locations_with_issues,
            "locations_with_alerts": locations_with_alerts,
            "data_quality_pct": round((1 - locations_with_issues / len(self.locations)) * 100, 1) if self.locations else 0,
        }
    
    def export_json(self, filepath: str):
        """Export to JSON file"""
        
        # Create the output structure
        output = {
            "generated_at": datetime.now().isoformat(),
            "summary": self.get_summary(),
            "accounts": self.accounts,
            "locations": self.locations,
        }
        
        with open(filepath, 'w') as f:
            json.dump(output, f, indent=2, default=str)
        
        print(f"Exported to {filepath}")
    
    def export_locations_only(self, filepath: str):
        """Export just locations array for the dashboard"""
        
        # Clean up locations for frontend consumption
        clean_locations = []
        for loc in self.locations:
            # Use actual coordinates for map even if flagged as missing
            clean_loc = {**loc}
            if clean_loc.get("lat") is None:
                clean_loc["lat"] = clean_loc["lat_actual"]
                clean_loc["lon"] = clean_loc["lon_actual"]
            
            # Remove internal fields
            clean_loc.pop("template", None)
            clean_loc.pop("lat_actual", None)
            clean_loc.pop("lon_actual", None)
            
            clean_locations.append(clean_loc)
        
        with open(filepath, 'w') as f:
            json.dump(clean_locations, f, indent=2, default=str)
        
        print(f"Exported {len(clean_locations)} locations to {filepath}")


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    """Generate the enhanced portfolio"""
    
    config = GeneratorConfig(
        seed=42,
        num_accounts=15,
        min_locations_per_account=15,
        max_locations_per_account=80,
        pct_missing_coordinates=0.08,
        pct_missing_construction=0.12,
        pct_missing_sqft=0.15,
        pct_stale_inspection=0.10,
    )
    
    generator = EnhancedPropertyGenerator(config)
    accounts, locations = generator.generate_portfolio()
    
    # Print summary
    summary = generator.get_summary()
    print("\n" + "="*60)
    print("PORTFOLIO SUMMARY")
    print("="*60)
    print(f"Total Accounts: {summary['total_accounts']}")
    print(f"Total Locations: {summary['total_locations']}")
    print(f"Total TIV: ${summary['total_tiv']:,.2f}")
    print(f"Average TIV per Location: ${summary['avg_tiv']:,.2f}")
    print(f"Average Locations per Account: {summary['avg_locations_per_account']:.1f}")
    print(f"States Represented: {summary['states_represented']}")
    print(f"Locations with Data Quality Issues: {summary['locations_with_data_issues']} ({100-summary['data_quality_pct']:.1f}%)")
    print(f"Locations with Risk Control Alerts: {summary['locations_with_alerts']}")
    
    print("\nAccount Type Distribution:")
    for acc_type, count in summary['account_type_distribution'].items():
        print(f"  {acc_type}: {count}")
    
    print("\nTop States by Location Count:")
    for state, count in list(summary['state_distribution'].items())[:10]:
        print(f"  {state}: {count}")
    
    # Export
    generator.export_json("/home/claude/portfolio_full.json")
    generator.export_locations_only("/home/claude/portfolio.json")
    
    return generator


if __name__ == "__main__":
    main()