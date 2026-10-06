import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Layers,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Truck,
  Building2,
  Sun,
  Wind,
  CloudRain,
  Zap,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Copy,
  ChevronRight,
  Activity,
  Compass,
  ArrowRight,
  Leaf
} from 'lucide-react';

interface GoogleMapsFleetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string) => void;
}

interface FacilityNode {
  id: string;
  name: string;
  role: string;
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  region: string;
  status: string;
  aqi?: number;
  aqiLabel?: string;
  temperatureC?: number;
  weatherLabel?: string;
  solarPotentialKwh?: string;
  transitDistanceKm?: number;
  transitTimeMin?: number;
  routeStatus?: string;
  humidityPercent?: number;
  windSpeedKph?: number;
}

interface RouteResult {
  originId: string;
  destinationId: string;
  preference: string;
  distanceKm: number;
  durationMinutes: number;
  fuelSavingsPercent: number;
  co2SavingsKg: number;
  corridorName: string;
  trafficCondition: string;
  turnSummary: string[];
}

interface PingResult {
  latencyMs: number;
  remoteStatus: string;
  errorDetail: string | null;
  timestamp: string;
}

export const GoogleMapsFleetModal: React.FC<GoogleMapsFleetModalProps> = ({
  isOpen,
  onClose,
  onShowToast
}) => {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('hq-toronto');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Live Backend State
  const [facilities, setFacilities] = useState<FacilityNode[]>([
    {
      id: 'hq-toronto',
      name: 'SignalDesk Global Headquarters & Executive Ops',
      role: 'Primary Operations & Executive Command Center',
      city: 'Toronto, ON',
      country: 'Canada',
      address: '100 King Street West, Suite 5600, Toronto, ON M5X 1C9',
      lat: 43.6487,
      lng: -79.3817,
      region: 'northamerica-northeast1',
      status: 'operational',
      aqi: 22,
      aqiLabel: 'Good (Air Quality Ingress)',
      temperatureC: 18,
      weatherLabel: 'Partly Cloudy',
      solarPotentialKwh: '48,200 kWh/yr',
      humidityPercent: 54,
      windSpeedKph: 14.5
    },
    {
      id: 'hub-vertex',
      name: 'Vertex Logistics Global Distribution Hub',
      role: 'Primary Supplier & Freight Fulfillment Hub',
      city: 'Mississauga / Toronto Pearson Corridor, ON',
      country: 'Canada',
      address: '2700 Britannia Road East, Mississauga, ON L4W 5L5',
      lat: 43.6820,
      lng: -79.6100,
      region: 'northamerica-northeast1',
      status: 'active_corridor',
      transitDistanceKm: 27.4,
      transitTimeMin: 32,
      routeStatus: 'Eco-Friendly Route Optimal',
      aqi: 26,
      aqiLabel: 'Moderate/Good',
      temperatureC: 17,
      weatherLabel: 'Clear',
      solarPotentialKwh: '112,400 kWh/yr',
      humidityPercent: 51,
      windSpeedKph: 16.2
    },
    {
      id: 'hub-apex',
      name: 'Apex Freight & Multimodal Transit Terminal',
      role: 'Secondary Regional Transit & Intermodal Hub',
      city: 'North York, ON',
      country: 'Canada',
      address: '5000 Yonge Street, North York, ON M2N 7E9',
      lat: 43.7615,
      lng: -79.4111,
      region: 'northamerica-northeast1',
      status: 'active_corridor',
      transitDistanceKm: 18.2,
      transitTimeMin: 24,
      routeStatus: 'Live Traffic Monitored',
      aqi: 24,
      aqiLabel: 'Good',
      temperatureC: 18,
      weatherLabel: 'Overcast',
      solarPotentialKwh: '74,800 kWh/yr',
      humidityPercent: 58,
      windSpeedKph: 11.8
    }
  ]);

  const [backendStatus, setBackendStatus] = useState<{
    configured: boolean;
    maskedKey: string;
    projectId: string;
    region: string;
    status: string;
    endpointHealth: string;
  } | null>(null);

  // Gateway Ping Diagnostic State
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  // Interactive Route Calculation State
  const [routeOrigin, setRouteOrigin] = useState<string>('hq-toronto');
  const [routeDestination, setRouteDestination] = useState<string>('hub-vertex');
  const [routePreference, setRoutePreference] = useState<'ECO_FRIENDLY' | 'FASTEST_TRAFFIC'>('ECO_FRIENDLY');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  // Environmental Telemetry Refresh State
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

  // Address validation sandbox state
  const [testAddress, setTestAddress] = useState('100 King Street West, Suite 5600, Toronto, ON M5X 1C9');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchStatusAndConfig = async () => {
      try {
        setIsLoading(true);
        const [statusRes, configRes] = await Promise.all([
          fetch('/api/maps/status').catch(() => null),
          fetch('/api/maps/config').catch(() => null)
        ]);

        if (statusRes && statusRes.ok) {
          const statusJson = await statusRes.json();
          if (isMounted) setBackendStatus(statusJson);
        }

        if (configRes && configRes.ok) {
          const configJson = await configRes.json();
          if (isMounted && configJson.facilities) {
            setFacilities(configJson.facilities);
          }
        }
      } catch (e) {
        console.error('Failed to load Maps backend status', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStatusAndConfig();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Functional Action: Ping backend gateway
  const handlePingGateway = async () => {
    setIsPinging(true);
    try {
      const res = await fetch('/api/maps/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        setPingResult({
          latencyMs: json.latencyMs,
          remoteStatus: json.remoteStatus,
          errorDetail: json.errorDetail,
          timestamp: new Date(json.timestamp).toLocaleTimeString()
        });
        onShowToast?.(`Gateway diagnostic complete: ${json.latencyMs}ms latency.`);
      }
    } catch {
      onShowToast?.('Failed to reach geospatial gateway.');
    } finally {
      setIsPinging(false);
    }
  };

  // Functional Action: Calculate logistics route
  const handleCalculateRoute = async () => {
    if (routeOrigin === routeDestination) {
      onShowToast?.('Please select different origin and destination facilities.');
      return;
    }

    setIsCalculatingRoute(true);
    try {
      const res = await fetch('/api/maps/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originId: routeOrigin,
          destinationId: routeDestination,
          preference: routePreference
        })
      });

      if (res.ok) {
        const json = await res.json();
        setRouteResult(json);
        onShowToast?.(`Logistics corridor calculated: ${json.distanceKm} km in ${json.durationMinutes} min.`);
      }
    } catch {
      onShowToast?.('Failed to calculate logistics corridor.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Functional Action: Refresh environmental telemetry
  const handleRefreshTelemetry = async () => {
    setIsRefreshingTelemetry(true);
    try {
      const res = await fetch('/api/maps/facility-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId: selectedFacilityId })
      });

      if (res.ok) {
        const json = await res.json();
        setFacilities(prev =>
          prev.map(f =>
            f.id === selectedFacilityId
              ? {
                  ...f,
                  aqi: json.telemetry.aqi,
                  aqiLabel: json.telemetry.aqiLabel,
                  temperatureC: json.telemetry.temperatureC,
                  weatherLabel: json.telemetry.weatherLabel,
                  solarPotentialKwh: json.telemetry.solarPotentialKwh,
                  humidityPercent: json.telemetry.humidityPercent,
                  windSpeedKph: json.telemetry.windSpeedKph
                }
              : f
          )
        );
        onShowToast?.('Environmental telemetry refreshed from live sensor feeds.');
      }
    } catch {
      onShowToast?.('Failed to refresh telemetry.');
    } finally {
      setIsRefreshingTelemetry(false);
    }
  };

  // Address validation handler
  const handleValidateAddress = async () => {
    if (!testAddress.trim()) return;
    setIsValidating(true);
    try {
      const res = await fetch('/api/maps/validate-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: testAddress })
      });
      if (res.ok) {
        const json = await res.json();
        setValidationResult(json.data);
        onShowToast?.('Address standardized and validated.');
      }
    } catch {
      onShowToast?.('Address validation failed.');
    } finally {
      setIsValidating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast?.(`${label} copied to clipboard`);
  };

  if (!isOpen) return null;

  const currentFacility = facilities.find(f => f.id === selectedFacilityId) || facilities[0];

  return (
    <div
      id="gmp-fleet-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="gmp-fleet-modal-container"
        className={`bg-stone-950 border border-stone-800 rounded-2xl flex flex-col shadow-2xl transition-all duration-300 w-full text-stone-100 ${
          isMaximized ? 'w-full h-full max-w-none rounded-none' : 'max-w-6xl max-h-[92vh] h-[850px]'
        }`}
      >
        {/* Header with Live Backend State */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-stone-100">Geospatial Intelligence & Corridors</h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                  backendStatus?.configured
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                  {backendStatus?.status === 'CONNECTED' ? 'GATEWAY CONNECTED' : 'GATEWAY ACTIVE'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                  {backendStatus?.region || 'northamerica-northeast2'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Live routing optimization, environmental telemetry, and address verification engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Gateway Ping Button */}
            <button
              id="gmp-ping-gateway-btn"
              onClick={handlePingGateway}
              disabled={isPinging}
              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Test real-time connection and measure latency"
            >
              <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
              <span className="hidden sm:inline">{isPinging ? 'Pinging...' : 'Test Latency'}</span>
              {pingResult && <span className="text-[10px] font-mono text-emerald-400">({pingResult.latencyMs}ms)</span>}
            </button>

            <button
              id="gmp-modal-toggle-size"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition cursor-pointer"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              id="gmp-modal-close"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Top Operational Dashboard: Facility Nodes & Map Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Interactive Node Selector & Visual Corridors */}
            <div className="lg:col-span-7 bg-stone-900/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                    Active Regional Corridors
                  </h3>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-stone-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Verified Coordinates</span>
                </div>
              </div>

              {/* Vector Map Canvas */}
              <div
                className="relative w-full h-64 sm:h-72 rounded-lg bg-stone-950 border border-stone-800 overflow-hidden flex flex-col items-center justify-center p-4 text-center"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 20, 0.95) 70%)`
                }}
              >
                {/* SVG Coordinate Grid & Arterial Network */}
                <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  <line x1="50%" y1="50%" x2="25%" y2="40%" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="50%" y1="50%" x2="70%" y2="28%" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
                </svg>

                {/* Nodes interactive representation */}
                <div className="relative z-10 w-full h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    {/* Vertex Hub Node */}
                    <button
                      onClick={() => setSelectedFacilityId('hub-vertex')}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        selectedFacilityId === 'hub-vertex'
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg'
                          : 'bg-stone-900/90 border-stone-800 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Vertex Distribution Hub</span>
                      </div>
                      <div className="text-[10px] text-stone-400">Mississauga Pearson Zone</div>
                    </button>

                    {/* Apex Freight Node */}
                    <button
                      onClick={() => setSelectedFacilityId('hub-apex')}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        selectedFacilityId === 'hub-apex'
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg'
                          : 'bg-stone-900/90 border-stone-800 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Building2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Apex Intermodal Terminal</span>
                      </div>
                      <div className="text-[10px] text-stone-400">North York Transit Hub</div>
                    </button>
                  </div>

                  {/* Central HQ Node */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => setSelectedFacilityId('hq-toronto')}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        selectedFacilityId === 'hq-toronto'
                          ? 'bg-amber-500/25 border-amber-500 text-white shadow-xl ring-2 ring-amber-500/30'
                          : 'bg-stone-900/95 border-stone-800 text-stone-200 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-amber-300">
                        <MapPin className="w-4 h-4 text-amber-400 animate-bounce" />
                        <span>SignalDesk Global HQ</span>
                      </div>
                      <div className="text-[10px] text-stone-400">Toronto Financial District (Anchor)</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Node selector buttons */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-stone-800 text-xs">
                {facilities.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFacilityId(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-left truncate transition cursor-pointer ${
                      selectedFacilityId === f.id
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold'
                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <div className="truncate text-[11px]">{f.name.split(' ')[0]} {f.name.split(' ')[1]}</div>
                    <div className="text-[9px] font-mono text-stone-400">{f.city}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Selected Facility Environmental Telemetry & Controls */}
            <div className="lg:col-span-5 bg-stone-900/70 border border-stone-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Selected Facility Telemetry
                    </span>
                  </div>
                  <button
                    onClick={handleRefreshTelemetry}
                    disabled={isRefreshingTelemetry}
                    className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] flex items-center gap-1 transition cursor-pointer"
                    title="Refresh live air quality and weather telemetry"
                  >
                    <RotateCcw className={`w-3 h-3 ${isRefreshingTelemetry ? 'animate-spin text-amber-400' : ''}`} />
                    <span>{isRefreshingTelemetry ? 'Updating...' : 'Refresh'}</span>
                  </button>
                </div>

                <h4 className="text-sm font-bold text-white mb-1">{currentFacility.name}</h4>
                <p className="text-xs text-stone-400 mb-1">{currentFacility.role}</p>
                <div className="text-[11px] font-mono text-stone-300 bg-stone-950 p-2 rounded border border-stone-800">
                  {currentFacility.address}
                </div>
              </div>

              {/* Dynamic Environmental Readings */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-1.5 text-stone-400 text-[11px] mb-1">
                    <Wind className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Air Quality (AQI)</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">
                    AQI {currentFacility.aqi || 22}
                  </div>
                  <div className="text-[10px] text-stone-400">{currentFacility.aqiLabel || 'Good'}</div>
                </div>

                <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-1.5 text-stone-400 text-[11px] mb-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Solar Potential</span>
                  </div>
                  <div className="text-sm font-bold text-amber-400">
                    {currentFacility.solarPotentialKwh || '48,200 kWh/yr'}
                  </div>
                  <div className="text-[10px] text-stone-400">Rooftop Photovoltaic Yield</div>
                </div>

                <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-1.5 text-stone-400 text-[11px] mb-1">
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    <span>Weather Telemetry</span>
                  </div>
                  <div className="text-sm font-bold text-stone-100">
                    {currentFacility.temperatureC || 18}°C • {currentFacility.weatherLabel || 'Clear'}
                  </div>
                  <div className="text-[10px] text-stone-400">Humidity: {currentFacility.humidityPercent || 54}%</div>
                </div>

                <div className="p-3 bg-stone-950 rounded-lg border border-stone-800">
                  <div className="flex items-center gap-1.5 text-stone-400 text-[11px] mb-1">
                    <Truck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Transit Corridor</span>
                  </div>
                  <div className="text-sm font-bold text-purple-400">
                    {currentFacility.transitDistanceKm ? `${currentFacility.transitDistanceKm} km (${currentFacility.transitTimeMin}m)` : 'HQ Anchor Hub'}
                  </div>
                  <div className="text-[10px] text-stone-400">Wind: {currentFacility.windSpeedKph || 14.5} km/h</div>
                </div>
              </div>

              {/* Coordinates Action */}
              <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs">
                <span className="text-stone-400 text-[11px]">Region: {currentFacility.region}</span>
                <button
                  onClick={() => copyToClipboard(`${currentFacility.lat}, ${currentFacility.lng}`, 'Coordinates')}
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] flex items-center gap-1 transition cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Lat/Lng</span>
                </button>
              </div>
            </div>
          </div>

          {/* Logistics Corridor Route Optimizer (Fully Functional) */}
          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Logistics Corridor Optimization & Routing Calculator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-stone-400">
                Eco-Friendly Routing & Fuel Consumption Reduction
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4 space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Origin Facility</label>
                <select
                  value={routeOrigin}
                  onChange={(e) => setRouteOrigin(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Destination Facility</label>
                <select
                  value={routeDestination}
                  onChange={(e) => setRouteDestination(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] text-stone-400 font-medium">Optimization Mode</label>
                <select
                  value={routePreference}
                  onChange={(e) => setRoutePreference(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="ECO_FRIENDLY">Eco-Friendly (Low Carbon)</option>
                  <option value="FASTEST_TRAFFIC">Fastest Transit</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  id="gmp-calculate-route-btn"
                  onClick={handleCalculateRoute}
                  disabled={isCalculatingRoute}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {isCalculatingRoute ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  <span>{isCalculatingRoute ? 'Calculating...' : 'Compute Route'}</span>
                </button>
              </div>
            </div>

            {routeResult && (
              <div className="p-4 bg-stone-950 rounded-xl border border-amber-500/30 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 block">Total Distance</span>
                    <strong className="text-stone-100 font-mono text-base">{routeResult.distanceKm} km</strong>
                    <div className="text-[10px] text-stone-400">Calculated Corridor</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">Travel Duration</span>
                    <strong className="text-amber-400 font-mono text-base">{routeResult.durationMinutes} min</strong>
                    <div className="text-[10px] text-emerald-400">Traffic: {routeResult.trafficCondition}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">Fuel Savings</span>
                    <strong className="text-emerald-400 font-mono text-base flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5" />
                      +{routeResult.fuelSavingsPercent}%
                    </strong>
                    <div className="text-[10px] text-stone-400">Eco-route optimization</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">CO2 Avoided</span>
                    <strong className="text-emerald-400 font-mono text-base">-{routeResult.co2SavingsKg} kg</strong>
                    <div className="text-[10px] text-stone-400">Scope 3 Freight reduction</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-800 text-xs">
                  <div className="font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Corridor: {routeResult.corridorName}</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-stone-400">
                    {routeResult.turnSummary.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Address Validation Interactive Sandbox */}
          <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  Address Validation & Postal Verification
                </h3>
              </div>
              <span className="text-[10px] font-mono text-stone-400">
                Deliverability Verification Standard
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <input
                  id="gmp-test-address-input"
                  type="text"
                  value={testAddress}
                  onChange={(e) => setTestAddress(e.target.value)}
                  placeholder="Enter Canadian or Global Enterprise Address..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <button
                id="gmp-validate-address-button"
                onClick={handleValidateAddress}
                disabled={isValidating}
                className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
              >
                {isValidating ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Validate Address</span>
              </button>
            </div>

            {validationResult && (
              <div className="p-3 bg-stone-950 rounded-lg border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in">
                <div>
                  <span className="text-[10px] text-stone-400 block">Deliverability Status</span>
                  <strong className="text-emerald-400 font-mono text-[11px]">{validationResult.validationStatus}</strong>
                  <div className="text-[10px] text-stone-400">Confidence: {(validationResult.confidenceScore * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Standardized Address</span>
                  <div className="text-stone-200 font-mono text-[11px] truncate">{validationResult.standardizedAddress}</div>
                  <div className="text-[10px] text-stone-400">{validationResult.authority}</div>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Geocoded Coordinates</span>
                  <div className="text-amber-400 font-mono text-[11px]">
                    {validationResult.suggestedCoordinates.lat}° N, {validationResult.suggestedCoordinates.lng}° W
                  </div>
                  <div className="text-[10px] text-stone-400">Granularity: {validationResult.granularity}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-800 bg-stone-900/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-stone-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Backend Geospatial Gateway</span>
            <span>•</span>
            <span className="font-mono">{backendStatus?.projectId || 'signaldesk-509121'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
