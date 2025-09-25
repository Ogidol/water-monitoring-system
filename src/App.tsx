import { useState, useEffect, useCallback } from "react";
import {
  Droplets,
  Bell,
  Settings,
  User,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Activity,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Battery,
  Thermometer,
  Menu,
  X,
  Download,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Progress } from "./components/ui/progress";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Toaster } from "./components/ui/sonner";
import TankVisualization from "./components/TankVisualization";
import WaterUsageCards from "./components/WaterUsageCards";
import UsageCharts from "./components/UsageCharts";
import Login from "./components/Login";
import SplashScreen from "./components/SplashScreen";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import thingSpeakService, {
  WaterLevelData,
  HistoricalData,
} from "./services/thingspeakService";
import usageService, { UsageSummary } from "./services/usageService";
import excelExportService from "./services/excelExportService";
import { toast } from "sonner@2.0.3";
import { registerSW, checkForUpdates } from "./utils/pwa";

type Alert = {
  id: number;
  type: "danger" | "warning" | "info";
  message: string;
  timestamp: string;
  resolved: boolean;
};

export default function App() {
  // Application flow states
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // PWA states
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Screen size tracking for responsive design
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Current tab
  const [activeTab, setActiveTab] = useState("dashboard");

  // Real-time data states
  const [waterData, setWaterData] = useState<WaterLevelData>({
    waterLevel: 0,
    tankCapacity: 10000,
    pumpStatus: "OFF",
    timestamp: new Date().toISOString(),
    lastUpdate: "Loading...",
  });

  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary>({
    daily: { usage: 0, intake: 0, net: 0, efficiency: 0 },
    monthly: { usage: 0, intake: 0, net: 0, efficiency: 0, averageDaily: 0 },
    yearly: { usage: 0, intake: 0, net: 0, efficiency: 0, averageDaily: 0, averageMonthly: 0 },
  });
  const [historicalUsage, setHistoricalUsage] = useState<any[]>([]);
  const [hourlyUsage, setHourlyUsage] = useState<number[]>(new Array(24).fill(0));

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "error"
  >("disconnected");
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());

  // Smart pump status tracking
  const [waterLevelHistory, setWaterLevelHistory] = useState<number[]>([]);
  const [pumpStatus, setPumpStatus] = useState<"ON" | "OFF">("OFF");

  // Updated: Slower refresh for real API to avoid rate limiting
  const REFRESH_INTERVAL = 30000; // 30 seconds for real ThingSpeak API calls

  // Track screen width changes
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper function to safely check PWA status
  const isPWAMode = () => {
    try {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || 
             (window.navigator as any).standalone === true;
    } catch (error) {
      return false;
    }
  };

  // PWA Setup and Service Worker Registration
  useEffect(() => {
    const initializePWA = async () => {
      // Register service worker
      try {
        await registerSW();
        console.log("🔧 Service Worker registered successfully");
        
        // Check for updates periodically
        const updateCheckInterval = setInterval(async () => {
          const hasUpdate = await checkForUpdates();
          if (hasUpdate) {
            setUpdateAvailable(true);
            toast.info("New app version available! Refresh to update.", {
              duration: 10000,
              action: {
                label: "Refresh",
                onClick: () => window.location.reload()
              }
            });
          }
        }, 60000); // Check every minute

        return () => clearInterval(updateCheckInterval);
      } catch (error) {
        console.error("🚨 Service Worker registration failed:", error);
      }

      // Handle PWA install prompt
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        console.log("💾 PWA install prompt triggered");
        setShowPWAPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Check if app is already installed
      if (isPWAMode()) {
        console.log("📱 App is running in standalone mode (PWA installed)");
        document.documentElement.classList.add('pwa-installed');
      }
    };

    initializePWA();
  }, []);

  // Online/Offline Detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("✅ Connection restored - syncing data...");
      // Trigger data refresh when coming back online
      if (isLoggedIn) {
        fetchCurrentData();
        fetchHistoricalData();
        fetchUsageData();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("📶 You're offline - using cached data", {
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isLoggedIn]);

  // Responsive helper functions
  const is320 = screenWidth <= 320;
  const is375 = screenWidth <= 375;
  const isSmallMobile = screenWidth <= 480;

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isMobileMenuOpen && !target.closest(".mobile-menu-container")) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileMenuOpen]);

  // Smart pump status logic based on water level trends
  const determinePumpStatus = useCallback(
    (currentLevel: number, levelHistory: number[]): "ON" | "OFF" => {
      if (levelHistory.length < 3) return "OFF"; // Need at least 3 readings for trend analysis

      const recentReadings = levelHistory.slice(-5); // Use last 5 readings for trend
      const averageChange =
        recentReadings.reduce((acc, level, index) => {
          if (index === 0) return acc;
          return acc + (level - recentReadings[index - 1]);
        }, 0) /
        (recentReadings.length - 1);

      // Determine pump status based on trend
      if (averageChange > 0.5) {
        // Water level is increasing significantly - pump should be ON
        return "ON";
      } else if (averageChange < -0.2) {
        // Water level is decreasing - pump should be OFF
        return "OFF";
      } else {
        // Level is relatively stable - keep current status or turn OFF if level is adequate
        return currentLevel > 60 ? "OFF" : "ON";
      }
    },
    []
  );

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileMenuOpen]);

  // Fetch current water level data
  const fetchCurrentData = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) setIsRefreshing(true);

        const data = await thingSpeakService.getCurrentWaterLevel();

        // Update water level history for pump logic
        setWaterLevelHistory((prev) => {
          const newHistory = [...prev, data.waterLevel].slice(-10); // Keep last 10 readings

          // Determine smart pump status
          const smartPumpStatus = determinePumpStatus(
            data.waterLevel,
            newHistory
          );
          setPumpStatus(smartPumpStatus);

          // Update data with smart pump status
          const updatedData = { ...data, pumpStatus: smartPumpStatus };
          setWaterData(updatedData);

          // Update usage service with new data
          usageService.addUsagePoint(data.waterLevel, data.tankCapacity, smartPumpStatus);

          console.log(
            `🔄 Smart Pump Logic (${new Date().toLocaleTimeString()}):`,
            {
              waterLevel: data.waterLevel,
              trend:
                newHistory.length > 1
                  ? (
                      data.waterLevel - newHistory[newHistory.length - 2]
                    ).toFixed(2)
                  : "0",
              pumpStatus: smartPumpStatus,
              history: newHistory.slice(-5),
            }
          );

          return newHistory;
        });

        // Set connection status based on data quality and recency
        if (data.lastUpdate === "Connection Error") {
          setConnectionStatus("error");
        } else {
          // Check if data is recent (within last 10 minutes)
          const dataTime = new Date(data.timestamp);
          const now = new Date();
          const diffMinutes = (now.getTime() - dataTime.getTime()) / (1000 * 60);
          
          if (diffMinutes > 10) {
            setConnectionStatus("disconnected");
          } else {
            setConnectionStatus("connected");
          }
        }
        setLastFetchTime(new Date());
      } catch (error) {
        console.error("Error fetching current data:", error);
        setConnectionStatus("error");
      } finally {
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [determinePumpStatus]
  );

  // Fetch historical data for charts
  const fetchHistoricalData = useCallback(async () => {
    try {
      const data = await thingSpeakService.getHistoricalData(24);
      setHistoricalData(data);
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  }, []);

  // Fetch usage data
  const fetchUsageData = useCallback(async () => {
    try {
      const summary = usageService.getUsageSummary();
      const historical = usageService.getHistoricalUsage(30);
      const hourly = usageService.getTodayHourlyUsage();
      
      setUsageSummary(summary);
      setHistoricalUsage(historical);
      setHourlyUsage(hourly);
    } catch (error) {
      console.error("Error fetching usage data:", error);
    }
  }, []);

  // Initial data load - only when logged in
  useEffect(() => {
    if (!isLoggedIn) return;

    const loadInitialData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchCurrentData(), 
        fetchHistoricalData(), 
        fetchUsageData()
      ]);
      setIsLoading(false);
      console.log(
        "📊 Initial data loaded - ThingSpeak API monitoring started (30s intervals)"
      );
    };

    loadInitialData();
  }, [isLoggedIn, fetchCurrentData, fetchHistoricalData, fetchUsageData]);

  // Set up API polling for real ThingSpeak data - only when logged in
  useEffect(() => {
    if (!isLoggedIn) return;

    console.log("⚡ Starting ThingSpeak API polling every 30 seconds...");

    const interval = setInterval(() => {
      fetchCurrentData();
      fetchUsageData(); // Also update usage data
    }, REFRESH_INTERVAL);

    return () => {
      console.log("🛑 Stopping API polling");
      clearInterval(interval);
    };
  }, [isLoggedIn, fetchCurrentData, fetchUsageData]);

  // Manual refresh handler
  const handleRefresh = async () => {
    console.log("🔄 Manual refresh triggered");
    setIsRefreshing(true);

    try {
      // Test connection first
      const isConnected = await thingSpeakService.testConnection();
      
      if (!isConnected) {
        toast.warning("ThingSpeak API connection issue - using cached data");
      }

      await Promise.all([
        fetchCurrentData(true), 
        fetchHistoricalData(), 
        fetchUsageData()
      ]);
      setIsMobileMenuOpen(false); // Close mobile menu after action
      
      toast.success("Data refreshed successfully!");
    } catch (error) {
      console.error("Refresh failed:", error);
      toast.error("Failed to refresh data. Check your connection.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Excel export handler
  const handleExcelExport = async () => {
    console.log("📊 Excel export triggered");
    setIsExporting(true);
    setIsMobileMenuOpen(false);

    try {
      const result = await excelExportService.exportToExcel(
        waterData,
        historicalData,
        usageSummary,
        historicalUsage
      );

      if (result.success) {
        toast.success(`Excel report generated: ${result.filename}`);
      } else {
        toast.error(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle splash screen completion
  const handleSplashComplete = () => {
    console.log("Splash screen completed, showing login");
    setShowSplash(false);
  };

  // Handle login
  const handleLogin = () => {
    setIsLoggedIn(true);
    toast.success("Welcome to your IoT Water Tank Dashboard!");
    console.log("User logged in successfully");
  };

  // Handle logout with menu close
  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    setIsLoggedIn(false);
    // Don't show splash again on logout, go directly to login
    setShowSplash(false);
    toast.info("You have been logged out successfully");
    console.log("User logged out");
  };

  // PWA Install Handler
  const handlePWAInstall = () => {
    setShowPWAPrompt(false);
    toast.success("🚀 App installed! You can now access it from your home screen.");
  };

  // PWA Dismiss Handler
  const handlePWADismiss = () => {
    setShowPWAPrompt(false);
    // Show again after 24 hours
    setTimeout(() => {
      setShowPWAPrompt(true);
    }, 24 * 60 * 60 * 1000);
  };

  // Debug handler for ThingSpeak status
  const handleDebugInfo = () => {
    const status = thingSpeakService.getSystemStatus();
    console.log("ThingSpeak System Status:", status);
    
    const debugInfo = `
🔧 ThingSpeak Debug Info:
• Channel: 3035826
• Status: ${status.isOnline ? 'Online' : 'Offline'}
• Cache: ${status.cacheStatus}
• Last Update: ${status.lastUpdate}
• Connection: ${connectionStatus}
• Water Level: ${waterData.waterLevel}%
    `.trim();
    
    toast.info(debugInfo, { duration: 5000 });
    setIsMobileMenuOpen(false);
  };

  // Generate alerts based on real data
  const generateAlerts = (): Alert[] => {
    const alerts: Alert[] = [];

    if (waterData.waterLevel < 20) {
      alerts.push({
        id: 1,
        type: "danger" as const,
        message: `🚨 Critical: Water level at ${waterData.waterLevel}% - immediate attention required`,
        timestamp: "0 minutes ago",
        resolved: false,
      });
    } else if (waterData.waterLevel < 40) {
      alerts.push({
        id: 2,
        type: "warning" as const,
        message: `⚠️ Warning: Water level low at ${waterData.waterLevel}%`,
        timestamp: "1 minute ago",
        resolved: false,
      });
    }

    if (pumpStatus === "OFF" && waterData.waterLevel < 60) {
      alerts.push({
        id: 3,
        type: "warning" as const,
        message:
          "⚠️ Smart pump is OFF while water level is below optimal range",
        timestamp: "2 minutes ago",
        resolved: false,
      });
    }

    // Add usage-based alerts
    if (usageSummary.daily.usage > 250) {
      alerts.push({
        id: 4,
        type: "warning" as const,
        message: `⚠️ High daily usage detected: ${usageSummary.daily.usage}L`,
        timestamp: "5 minutes ago",
        resolved: false,
      });
    }

    if (usageSummary.daily.net < -50) {
      alerts.push({
        id: 5,
        type: "danger" as const,
        message: `🚨 Daily deficit: ${Math.abs(usageSummary.daily.net)}L more usage than intake`,
        timestamp: "3 minutes ago",
        resolved: false,
      });
    }

    // Add pump trend alerts
    if (pumpStatus === "ON" && waterLevelHistory.length > 3) {
      const recentTrend = waterLevelHistory.slice(-3);
      const avgChange =
        recentTrend.reduce((acc, level, index) => {
          if (index === 0) return acc;
          return acc + (level - recentTrend[index - 1]);
        }, 0) /
        (recentTrend.length - 1);

      if (avgChange > 0.5) {
        alerts.push({
          id: 7,
          type: "info" as const,
          message: `✅ Smart pump activated - water level increasing (${avgChange.toFixed(
            1
          )}%/cycle)`,
          timestamp: "Just now",
          resolved: true,
        });
      }
    }

    if (connectionStatus === "error") {
      alerts.push({
        id: 8,
        type: "danger" as const,
        message: "❌ Connection to ESP8266 sensor lost",
        timestamp: "Just now",
        resolved: false,
      });
    }

    // Add some resolved alerts for demo
    alerts.push({
      id: 9,
      type: "info" as const,
      message: "✅ Daily sensor calibration completed successfully",
      timestamp: "30 minutes ago",
      resolved: true,
    });

    return alerts;
  };

  const alerts = generateAlerts();

  // Show splash screen on initial load
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show login screen if splash is done but not logged in
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Enhanced Line Chart Component with real historical data
  const LineChart = ({ data }: { data: HistoricalData[] }) => {
    const width = is320 ? 280 : is375 ? 320 : 700;
    const height = is320 ? 200 : is375 ? 240 : 320;
    const padding = is320 ? 40 : 80;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    if (!data || data.length === 0) {
      return (
        <div
          className={`w-full ${
            is320 ? "h-48" : "h-80"
          } flex items-center justify-center text-gray-500`}
        >
          <div className="text-center">
            <WifiOff
              className={`${
                is320 ? "w-8 h-8" : "w-12 h-12"
              } mx-auto mb-2 text-gray-400`}
            />
            <p className={is320 ? "text-xs" : "text-sm"}>
              No historical data available
            </p>
            <p className={`${is320 ? "text-xs" : "text-sm"} text-gray-400`}>
              Check ESP8266 connection
            </p>
          </div>
        </div>
      );
    }

    const maxLevel = Math.max(...data.map((d) => d.level), 100);
    const minLevel = Math.max(0, Math.min(...data.map((d) => d.level)) - 5);
    const range = maxLevel - minLevel || 1;

    // Create smooth curve path using Bézier curves
    const createSmoothPath = (data: HistoricalData[]) => {
      if (data.length < 2) return "";

      let path = "";
      for (let i = 0; i < data.length; i++) {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + ((maxLevel - data[i].level) / range) * chartHeight;

        if (i === 0) {
          path += `M ${x} ${y}`;
        } else {
          const prevX = padding + ((i - 1) / (data.length - 1)) * chartWidth;
          const prevY =
            padding + ((maxLevel - data[i - 1].level) / range) * chartHeight;
          const cpX1 = prevX + (x - prevX) / 3;
          const cpX2 = x - (x - prevX) / 3;
          path += ` C ${cpX1} ${prevY}, ${cpX2} ${y}, ${x} ${y}`;
        }
      }
      return path;
    };

    const smoothPath = createSmoothPath(data);

    return (
      <div
        className={`w-full ${
          is320 ? "h-48" : "h-80"
        } flex items-center justify-center overflow-x-auto`}
      >
        <svg
          width={width}
          height={height}
          className="rounded-lg min-w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
              <stop offset="50%" stopColor="rgba(59, 130, 246, 0.2)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.0)" />
            </linearGradient>
            <filter
              id="chartLineGlow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {(!is320 ? [0, 25, 50, 75, 100] : [0, 50, 100]).map((level) => {
            const y = padding + ((maxLevel - level) / range) * chartHeight;
            return (
              <g key={level}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="rgba(59, 130, 246, 0.12)"
                  strokeDasharray="6,12"
                  strokeWidth="1"
                />
                <text
                  x={padding - (is320 ? 15 : 25)}
                  y={y + 5}
                  textAnchor="end"
                  fontSize={is320 ? "10" : "13"}
                  fill="#6B7280"
                  fontFamily="Inter, Poppins, sans-serif"
                  fontWeight="500"
                >
                  {level}%
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {data
            .filter(
              (_, index) =>
                index %
                  Math.max(1, Math.floor(data.length / (is320 ? 3 : 6))) ===
                0
            )
            .map((item, displayIndex) => {
              const actualIndex =
                displayIndex *
                Math.max(1, Math.floor(data.length / (is320 ? 3 : 6)));
              const x =
                padding + (actualIndex / (data.length - 1)) * chartWidth;
              return (
                <text
                  key={displayIndex}
                  x={x}
                  y={height - padding + (is320 ? 20 : 30)}
                  textAnchor="middle"
                  fontSize={is320 ? "8" : "13"}
                  fill="#6B7280"
                  fontFamily="Inter, Poppins, sans-serif"
                  fontWeight="500"
                >
                  {is320 ? item.time.split(":")[0] + "h" : item.time}
                </text>
              );
            })}

          {/* Area fill */}
          <path
            d={`${smoothPath} L ${width - padding} ${
              height - padding
            } L ${padding} ${height - padding} Z`}
            fill="url(#chartAreaGradient)"
          />

          {/* Smooth line with enhanced glow */}
          <path
            d={smoothPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={is320 ? "3" : "5"}
            filter="url(#chartLineGlow)"
            style={{
              filter: "drop-shadow(0 0 12px rgba(59, 130, 246, 0.5))",
            }}
          />

          {/* Data points */}
          {data
            .filter(
              (_, index) =>
                index %
                  Math.max(1, Math.floor(data.length / (is320 ? 6 : 12))) ===
                0
            )
            .map((item, displayIndex) => {
              const actualIndex =
                displayIndex *
                Math.max(1, Math.floor(data.length / (is320 ? 6 : 12)));
              const x =
                padding + (actualIndex / (data.length - 1)) * chartWidth;
              const y =
                padding + ((maxLevel - item.level) / range) * chartHeight;
              return (
                <g key={actualIndex}>
                  <circle
                    cx={x}
                    cy={y}
                    r={is320 ? "4" : "7"}
                    fill="#3B82F6"
                    stroke="white"
                    strokeWidth={is320 ? "2" : "4"}
                    className="hover:r-9 transition-all cursor-pointer"
                    style={{
                      filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))",
                    }}
                  />
                  <title>{`${item.time}: ${item.level}%${
                    item.temperature ? `, ${item.temperature}°C` : ""
                  }`}</title>
                </g>
              );
            })}
        </svg>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50"
        style={{ minHeight: "100svh", height: "100vh" }}
      >
        <div className="text-center">
          <div
            className={`${
              is320 ? "w-12 h-12" : "w-16 h-16"
            } border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4`}
          ></div>
          <h2
            className={`${
              is320 ? "text-lg" : "text-xl"
            } font-semibold text-gray-800 mb-2`}
          >
            Connecting to ESP8266 Sensor
          </h2>
          <p className={`text-gray-600 ${is320 ? "text-sm" : ""}`}>
            Loading live water level data from ThingSpeak API...
          </p>
          <p className={`${is320 ? "text-xs" : "text-sm"} text-blue-600 mt-2`}>
            ⚡ Channel 3035826 • Live sensor data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        background:
          "linear-gradient(135deg, #E6F0FF 0%, #F0F8FF 40%, #FFFFFF 100%)",
      }}
    >
      {/* Enhanced Abstract Wave Patterns */}
      <div className="absolute inset-0 opacity-6 pointer-events-none">
        <svg
          className="absolute top-0 left-0 w-full h-full"
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="waveGradient1"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#93C5FD" />
            </linearGradient>
            <linearGradient
              id="waveGradient2"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient
              id="waveGradient3"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#DBEAFE" />
              <stop offset="100%" stopColor="#BFDBFE" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 C300,200 600,0 900,100 C1000,150 1100,50 1200,100 L1200,0 L0,0 Z"
            fill="url(#waveGradient1)"
            className="animate-pulse"
            opacity="0.08"
          />
          <path
            d="M0,300 C300,400 600,200 900,300 C1000,350 1100,250 1200,300 L1200,0 L0,0 Z"
            fill="url(#waveGradient2)"
            className="animate-pulse"
            opacity="0.04"
          />
          <path
            d="M0,500 C400,600 800,400 1200,500 L1200,0 L0,0 Z"
            fill="url(#waveGradient3)"
            className="animate-pulse"
            opacity="0.03"
          />
        </svg>
      </div>

      {/* Enhanced Responsive Header Bar */}
      <header
        className={`backdrop-blur-md border-b border-white/20 ${
          is320 ? "px-2 py-2" : "px-4 sm:px-6 py-4"
        } relative z-50 sticky top-0`}
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div className="max-w-10xl mx-auto">
          {/* Desktop Header - Hide on very small screens */}
          {!isSmallMobile && (
            <div className="hidden lg:flex items-center justify-between">
              {/* Left side - Logo and title with connection status */}
              <div className="flex items-center space-x-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                    boxShadow: "0 8px 20px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <Droplets className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Water Level Monitor
                    </h1>
                    {connectionStatus === "connected" && isOnline ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 animate-pulse">
                        <Wifi className="w-3 h-3 mr-1" />
                        ESP8266 Online • Live Data
                      </Badge>
                    ) : !isOnline ? (
                      <Badge
                        variant="destructive"
                        className="bg-orange-100 text-orange-800 border-orange-200"
                      >
                        <WifiOff className="w-3 h-3 mr-1" />
                        Offline Mode • Cached Data
                      </Badge>
                    ) : connectionStatus === "disconnected" ? (
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800 border-yellow-200"
                      >
                        <WifiOff className="w-3 h-3 mr-1" />
                        ESP8266 Stale Data
                      </Badge>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-red-100 text-red-800 border-red-200"
                      >
                        <WifiOff className="w-3 h-3 mr-1" />
                        ESP8266 Offline
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    ThingSpeak Channel: 3035826 • Last updated:{" "}
                    {waterData.lastUpdate}
                  </p>
                </div>
              </div>

              {/* Right side - Controls and user info */}
              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${
                      isRefreshing ? "animate-spin" : ""
                    }`}
                  />
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>

                <Button
                  onClick={handleExcelExport}
                  disabled={isExporting}
                  variant="outline"
                  size="sm"
                  className="border-green-200 text-green-600 hover:bg-green-50"
                >
                  <Download
                    className={`w-4 h-4 mr-2 ${
                      isExporting ? "animate-pulse" : ""
                    }`}
                  />
                  {isExporting ? "Exporting..." : "Export Excel"}
                </Button>

                <button className="relative p-3 text-gray-600 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                    {alerts.filter((a) => !a.resolved).length}
                  </span>
                </button>
                <button className="p-3 text-gray-600 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50">
                  <Settings className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      Idris Ogundele Olawale
                    </div>
                    <div className="text-xs text-gray-500">
                      System Administrator
                    </div>
                  </div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                    style={{
                      background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                    }}
                  >
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-600 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Header */}
          <div
            className={`${
              !isSmallMobile ? "lg:hidden" : ""
            } flex items-center justify-between`}
          >
            {/* Left side - Logo and essential info */}
            <div
              className={`flex items-center ${
                is320 ? "space-x-2" : "space-x-3"
              }`}
            >
              <div
                className={`${
                  is320 ? "w-8 h-8" : "w-10 h-10"
                } rounded-xl flex items-center justify-center shadow-lg`}
                style={{
                  background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                  boxShadow: "0 6px 16px rgba(59, 130, 246, 0.3)",
                }}
              >
                <Droplets
                  className={`${is320 ? "w-4 h-4" : "w-5 h-5"} text-white`}
                />
              </div>
              <div>
                <h1
                  className={`${
                    is320 ? "text-sm" : "text-lg"
                  } font-bold text-gray-900`}
                >
                  {is320 ? "Water" : "Water Monitor"}
                </h1>
                <div className="flex items-center space-x-2">
                  {connectionStatus === "connected" && isOnline ? (
                    <Badge
                      className={`bg-green-100 text-green-800 border-green-200 ${
                        is320 ? "text-xs px-1 py-0" : "text-xs"
                      } animate-pulse`}
                    >
                      <Wifi
                        className={`${is320 ? "w-2 h-2" : "w-2 h-2"} mr-1`}
                      />
                      {is320
                        ? `${waterData.waterLevel}%`
                        : `Live • ${waterData.waterLevel}%`}
                    </Badge>
                  ) : !isOnline ? (
                    <Badge
                      variant="destructive"
                      className={`bg-orange-100 text-orange-800 border-orange-200 ${
                        is320 ? "text-xs px-1 py-0" : "text-xs"
                      }`}
                    >
                      <WifiOff
                        className={`${is320 ? "w-2 h-2" : "w-2 h-2"} mr-1`}
                      />
                      {is320 ? "Cache" : "Offline"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="destructive"
                      className={`bg-red-100 text-red-800 border-red-200 ${
                        is320 ? "text-xs px-1 py-0" : "text-xs"
                      }`}
                    >
                      <WifiOff
                        className={`${is320 ? "w-2 h-2" : "w-2 h-2"} mr-1`}
                      />
                      Offline
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right side - Mobile menu toggle */}
            <div className="mobile-menu-container relative">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`${
                  is320 ? "p-1" : "p-2"
                } text-gray-600 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 relative z-10`}
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className={`${is320 ? "w-5 h-5" : "w-6 h-6"}`} />
                ) : (
                  <div className="relative">
                    <Menu className={`${is320 ? "w-5 h-5" : "w-6 h-6"}`} />
                    {alerts.filter((a) => !a.resolved).length > 0 && (
                      <span
                        className={`absolute -top-1 -right-1 ${
                          is320 ? "w-2 h-2" : "w-3 h-3"
                        } bg-red-500 rounded-full text-xs text-white flex items-center justify-center text-[10px]`}
                      >
                        {alerts.filter((a) => !a.resolved).length > 9
                          ? "9+"
                          : alerts.filter((a) => !a.resolved).length}
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Mobile Dropdown Menu */}
              {isMobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                  />

                  {/* Dropdown Menu */}
                  <div
                    className={`fixed right-0 top-full mt-2 ${
                      is320 ? "w-screen" : "w-80"
                    } max-w-[calc(100vw-1rem)] backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200`}
                    style={{
                      background: "rgba(255, 255, 255, 0.95)",
                      boxShadow:
                        "0 25px 60px rgba(0, 0, 0, 0.15), 0 0 40px rgba(8, 145, 178, 0.2)",
                      width: is320 ? "90%" : "250px",
                      right: "0",
                      margin: is320 ? "0 0.5rem" : "0",
                      transform: "translateX(-30%)",
                    }}
                  >
                    {/* User Info Section */}
                    <div
                      className={`${
                        is320 ? "p-3" : "p-4"
                      } border-b border-gray-200/50`}
                    >
                      <div
                        className={`flex items-center ${
                          is320 ? "space-x-2" : "space-x-3"
                        }`}
                      >
                        <div
                          className={`${
                            is320 ? "w-10 h-10" : "w-12 h-12"
                          } rounded-full flex items-center justify-center shadow-lg`}
                          style={{
                            background:
                              "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                          }}
                        >
                          <User
                            className={`${
                              is320 ? "w-5 h-5" : "w-6 h-6"
                            } text-white`}
                          />
                        </div>
                        <div className="flex-1">
                          <div
                            className={`${
                              is320 ? "text-xs" : "text-sm"
                            } font-semibold text-gray-900`}
                          >
                            {is320 ? "Idris Olawale" : "Idris Ogundele Olawale"}
                          </div>
                          <div
                            className={`${
                              is320 ? "text-xs" : "text-xs"
                            } text-gray-500`}
                          >
                            {is320 ? "222956" : "Matric No: 222956"}
                          </div>
                          <div
                            className={`${
                              is320 ? "text-xs" : "text-xs"
                            } text-gray-500`}
                          >
                            {is320 ? "Admin" : "System Administrator"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* System Status */}
                    <div
                      className={`${
                        is320 ? "p-3" : "p-4"
                      } border-b border-gray-200/50`}
                    >
                      <div
                        className={`${
                          is320 ? "text-xs" : "text-xs"
                        } font-semibold text-gray-700 mb-2 flex items-center`}
                      >
                        <span>System Status</span>
                        <span className="ml-2 text-green-600 animate-pulse">
                          • Live API
                        </span>
                      </div>
                      <div
                        className={`grid grid-cols-2 ${
                          is320 ? "gap-2" : "gap-3"
                        } text-xs`}
                      >
                        <div
                          className={`flex items-center justify-between ${
                            is320 ? "p-1" : "p-2"
                          } bg-blue-50 rounded-lg`}
                        >
                          <span className="text-gray-600">Water Level</span>
                          <span className="font-semibold text-blue-600">
                            {waterData.waterLevel}%
                          </span>
                        </div>
                        <div
                          className={`flex items-center justify-between ${
                            is320 ? "p-1" : "p-2"
                          } bg-gray-50 rounded-lg`}
                        >
                          <span className="text-gray-600">Capacity</span>
                          <span className="font-semibold text-gray-700">
                            {Math.round(
                              (waterData.tankCapacity * waterData.waterLevel) /
                                100
                            )}
                            L
                          </span>
                        </div>
                        <div
                          className={`flex items-center justify-between ${
                            is320 ? "p-1" : "p-2"
                          } bg-green-50 rounded-lg col-span-2`}
                        >
                          <span className="text-gray-600">Usage Today</span>
                          <span className="font-semibold text-green-600">
                            {usageSummary.daily.usage}L
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className={`${is320 ? "p-3" : "p-4"} space-y-2`}>
                      <div
                        className={`${
                          is320 ? "text-xs" : "text-xs"
                        } font-semibold text-gray-700 mb-3`}
                      >
                        Quick Actions
                      </div>

                      <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`w-full flex items-center justify-between ${
                          is320 ? "p-2" : "p-3"
                        } text-left hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50`}
                      >
                        <div
                          className={`flex items-center ${
                            is320 ? "space-x-2" : "space-x-3"
                          }`}
                        >
                          <RefreshCw
                            className={`${
                              is320 ? "w-3 h-3" : "w-4 h-4"
                            } text-blue-600 ${
                              isRefreshing ? "animate-spin" : ""
                            }`}
                          />
                          <span
                            className={`${
                              is320 ? "text-xs" : "text-sm"
                            } text-gray-700`}
                          >
                            {isRefreshing ? "Refreshing..." : "Refresh Data"}
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={handleExcelExport}
                        disabled={isExporting}
                        className={`w-full flex items-center justify-between ${
                          is320 ? "p-2" : "p-3"
                        } text-left hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50`}
                      >
                        <div
                          className={`flex items-center ${
                            is320 ? "space-x-2" : "space-x-3"
                          }`}
                        >
                          <Download
                            className={`${
                              is320 ? "w-3 h-3" : "w-4 h-4"
                            } text-green-600 ${
                              isExporting ? "animate-pulse" : ""
                            }`}
                          />
                          <span
                            className={`${
                              is320 ? "text-xs" : "text-sm"
                            } text-gray-700`}
                          >
                            {isExporting ? "Exporting..." : "Export Excel"}
                          </span>
                        </div>
                      </button>

                      <button
                        className={`w-full flex items-center justify-between ${
                          is320 ? "p-2" : "p-3"
                        } text-left hover:bg-orange-50 rounded-lg transition-colors`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div
                          className={`flex items-center ${
                            is320 ? "space-x-2" : "space-x-3"
                          }`}
                        >
                          <Bell
                            className={`${
                              is320 ? "w-3 h-3" : "w-4 h-4"
                            } text-orange-600`}
                          />
                          <span
                            className={`${
                              is320 ? "text-xs" : "text-sm"
                            } text-gray-700`}
                          >
                            Notifications
                          </span>
                        </div>
                        {alerts.filter((a) => !a.resolved).length > 0 && (
                          <span
                            className={`${
                              is320 ? "w-4 h-4" : "w-5 h-5"
                            } bg-red-500 rounded-full text-xs text-white flex items-center justify-center`}
                          >
                            {alerts.filter((a) => !a.resolved).length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={handleDebugInfo}
                        className={`w-full flex items-center justify-between ${
                          is320 ? "p-2" : "p-3"
                        } text-left hover:bg-purple-50 rounded-lg transition-colors`}
                      >
                        <div
                          className={`flex items-center ${
                            is320 ? "space-x-2" : "space-x-3"
                          }`}
                        >
                          <Settings
                            className={`${
                              is320 ? "w-3 h-3" : "w-4 h-4"
                            } text-purple-600`}
                          />
                          <span
                            className={`${
                              is320 ? "text-xs" : "text-sm"
                            } text-gray-700`}
                          >
                            {is320 ? "Debug" : "API Debug Info"}
                          </span>
                        </div>
                      </button>

                      {/* PWA Install Button - Only show if not installed */}
                      {showPWAPrompt && !isPWAMode() && (
                        <button
                          onClick={() => setShowPWAPrompt(true)}
                          className={`w-full flex items-center justify-between ${
                            is320 ? "p-2" : "p-3"
                          } text-left hover:bg-blue-50 rounded-lg transition-colors`}
                        >
                          <div
                            className={`flex items-center ${
                              is320 ? "space-x-2" : "space-x-3"
                            }`}
                          >
                            <Download
                              className={`${
                                is320 ? "w-3 h-3" : "w-4 h-4"
                              } text-blue-600`}
                            />
                            <span
                              className={`${
                                is320 ? "text-xs" : "text-sm"
                              } text-gray-700`}
                            >
                              {is320 ? "Install App" : "Install as App"}
                            </span>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            PWA
                          </Badge>
                        </button>
                      )}

                      <div className="border-t border-gray-200/50 pt-2 mt-3">
                        <button
                          onClick={handleLogout}
                          className={`w-full flex items-center ${
                            is320 ? "space-x-2" : "space-x-3"
                          } ${
                            is320 ? "p-2" : "p-3"
                          } text-left hover:bg-red-50 rounded-lg transition-colors text-red-600`}
                        >
                          <LogOut
                            className={`${is320 ? "w-3 h-3" : "w-4 h-4"}`}
                          />
                          <span
                            className={`${
                              is320 ? "text-xs" : "text-sm"
                            } font-medium`}
                          >
                            Sign Out
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Connection Info */}
                    <div
                      className={`${
                        is320 ? "p-2" : "p-4"
                      } border-t border-gray-200/50 bg-gray-50/50`}
                    >
                      <div
                        className={`${
                          is320 ? "text-xs" : "text-xs"
                        } text-gray-500 text-center`}
                      >
                        Last updated: {waterData.lastUpdate} • ThingSpeak API
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Tabs */}
      <main
        className={`max-w-10xl mx-auto ${
          is320 ? "px-1 py-4" : "px-4 sm:px-6 py-8"
        } relative z-10`}
      >
        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-3 ${is320 ? 'mb-4' : 'mb-6'} glassmorphism border-white/30`}>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Activity className={`${is320 ? 'w-3 h-3' : 'w-4 h-4'}`} />
              {is320 ? 'Monitor' : 'Dashboard'}
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <BarChart3 className={`${is320 ? 'w-3 h-3' : 'w-4 h-4'}`} />
              {is320 ? 'Usage' : 'Water Usage'}
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <Bell className={`${is320 ? 'w-3 h-3' : 'w-4 h-4'}`} />
              {is320 ? 'Alerts' : 'Notifications'}
              {alerts.filter((a) => !a.resolved).length > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {alerts.filter((a) => !a.resolved).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Four Premium KPI Cards with Real ESP8266 Data */}
            <div
              className={`grid grid-cols-1 ${
                isSmallMobile ? "" : "sm:grid-cols-2 lg:grid-cols-4"
              } ${is320 ? "gap-3 mb-4" : "gap-6 mb-8"}`}
            >
              {/* Current Water Level Card */}
              <Card
                className={`glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-white/30 ${
                  is320 ? "p-2" : ""
                }`}
              >
                <CardHeader
                  className={`flex flex-row items-center justify-between space-y-0 ${
                    is320 ? "pb-2" : "pb-3"
                  }`}
                >
                  <CardTitle
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } font-semibold text-gray-700`}
                  >
                    Water Level
                  </CardTitle>
                  <div
                    className={`${is320 ? "p-2" : "p-3"} rounded-xl shadow-lg`}
                    style={{
                      background:
                        waterData.waterLevel < 20
                          ? "linear-gradient(135deg, #EF4444, #DC2626)"
                          : waterData.waterLevel < 40
                          ? "linear-gradient(135deg, #F59E0B, #D97706)"
                          : "linear-gradient(135deg, #3B82F6, #60A5FA)",
                      boxShadow: "0 6px 16px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    <Droplets
                      className={`${is320 ? "h-3 w-3" : "h-5 w-5"} text-white`}
                    />
                  </div>
                </CardHeader>
                <CardContent className={is320 ? "p-2" : ""}>
                  <div
                    className={`${
                      is320 ? "text-2xl" : "text-4xl"
                    } font-bold text-gray-900 ${is320 ? "mb-2" : "mb-3"}`}
                  >
                    {waterData.waterLevel}%
                  </div>
                  <Progress
                    value={waterData.waterLevel}
                    className={`${is320 ? "h-2 mb-2" : "h-3 mb-3"}`}
                  />
                  <div
                    className={`flex items-center justify-between ${
                      is320 ? "text-xs" : "text-sm"
                    } text-gray-600`}
                  >
                    <span className="flex items-center">
                      <span
                        className={`${
                          is320 ? "w-1 h-1" : "w-2 h-2"
                        } bg-green-500 rounded-full mr-2 animate-pulse`}
                      ></span>
                      {is320 ? "Live" : "Live API Data"}
                    </span>
                    <span className="flex items-center">
                      {connectionStatus === "connected" ? (
                        <CheckCircle
                          className={`${
                            is320 ? "w-3 h-3" : "w-4 h-4"
                          } mr-1 text-green-500`}
                        />
                      ) : (
                        <AlertTriangle
                          className={`${
                            is320 ? "w-3 h-3" : "w-4 h-4"
                          } mr-1 text-red-500`}
                        />
                      )}
                      {is320
                        ? lastFetchTime.getHours() +
                          ":" +
                          lastFetchTime.getMinutes().toString().padStart(2, "0")
                        : `${waterData.lastUpdate}`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Tank Capacity Card */}
              <Card
                className={`glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-white/30 ${
                  is320 ? "p-2" : ""
                }`}
              >
                <CardHeader
                  className={`flex flex-row items-center justify-between space-y-0 ${
                    is320 ? "pb-2" : "pb-3"
                  }`}
                >
                  <CardTitle
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } font-semibold text-gray-700`}
                  >
                    Tank Capacity
                  </CardTitle>
                  <div
                    className={`${is320 ? "p-2" : "p-3"} rounded-xl shadow-lg`}
                    style={{
                      background: "linear-gradient(135deg, #10B981, #34D399)",
                      boxShadow: "0 6px 16px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <Activity
                      className={`${is320 ? "h-3 w-3" : "h-5 w-5"} text-white`}
                    />
                  </div>
                </CardHeader>
                <CardContent className={is320 ? "p-2" : ""}>
                  <div
                    className={`${
                      is320 ? "text-2xl" : "text-4xl"
                    } font-bold text-gray-900 mb-1`}
                  >
                    {waterData.tankCapacity}L
                  </div>
                  <p
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } text-gray-600 mb-2`}
                  >
                    Total capacity
                  </p>
                  <p className={`${is320 ? "text-xs" : "text-xs"} text-gray-600`}>
                    Current:{" "}
                    <span className="font-semibold text-blue-600">
                      {Math.round(
                        (waterData.tankCapacity * waterData.waterLevel) / 100
                      )}
                      L
                    </span>
                  </p>
                </CardContent>
              </Card>

              {/* ESP8266 Sensor Status Card */}
              <Card
                className={`glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-white/30 ${
                  is320 ? "p-2" : ""
                }`}
              >
                <CardHeader
                  className={`flex flex-row items-center justify-between space-y-0 ${
                    is320 ? "pb-2" : "pb-3"
                  }`}
                >
                  <CardTitle
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } font-semibold text-gray-700`}
                  >
                    ESP8266
                  </CardTitle>
                  <div
                    className={`${is320 ? "p-2" : "p-3"} rounded-xl shadow-lg`}
                    style={{
                      background:
                        connectionStatus === "connected"
                          ? "linear-gradient(135deg, #10B981, #34D399)"
                          : "linear-gradient(135deg, #EF4444, #DC2626)",
                      boxShadow: "0 6px 16px rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    {connectionStatus === "connected" ? (
                      <Wifi
                        className={`${is320 ? "h-3 w-3" : "h-5 w-5"} text-white`}
                      />
                    ) : (
                      <WifiOff
                        className={`${is320 ? "h-3 w-3" : "h-5 w-5"} text-white`}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className={is320 ? "p-2" : ""}>
                  <div
                    className={`flex items-center ${
                      is320 ? "space-x-2 mb-2" : "space-x-3 mb-3"
                    }`}
                  >
                    <Badge
                      variant={
                        connectionStatus === "connected" ? "default" : "destructive"
                      }
                      className={`${
                        connectionStatus === "connected"
                          ? "bg-green-100 text-green-800 shadow-sm font-semibold"
                          : "bg-red-100 text-red-800 shadow-sm font-semibold"
                      } ${is320 ? "px-2 py-0 text-xs" : "px-3 py-1"}`}
                    >
                      {connectionStatus === "connected" ? "ONLINE" : "OFFLINE"}
                    </Badge>
                    <div
                      className={`${is320 ? "w-2 h-2" : "w-3 h-3"} rounded-full ${
                        connectionStatus === "connected"
                          ? "bg-green-500 animate-pulse shadow-green-300"
                          : "bg-red-500"
                      } shadow-lg`}
                    ></div>
                  </div>
                  <p
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } text-gray-600 mb-1`}
                  >
                    {connectionStatus === "connected"
                      ? "Live Data Stream"
                      : "Connection Lost"}
                  </p>
                  <div
                    className={`flex items-center ${
                      is320 ? "text-xs" : "text-xs"
                    } text-gray-600`}
                  >
                    <Clock className={`${is320 ? "w-2 h-2" : "w-3 h-3"} mr-1`} />
                    <span>ThingSpeak API</span>
                  </div>
                </CardContent>
              </Card>

              {/* Smart Pump Status Card */}
              <Card
                className={`glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-white/30 ${
                  is320 ? "p-2" : ""
                }`}
              >
                <CardHeader
                  className={`flex flex-row items-center justify-between space-y-0 ${
                    is320 ? "pb-2" : "pb-3"
                  }`}
                >
                  <CardTitle
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } font-semibold text-gray-700`}
                  >
                    Smart Pump
                  </CardTitle>
                  <div
                    className={`${is320 ? "p-2" : "p-3"} rounded-xl shadow-lg`}
                    style={{
                      background:
                        pumpStatus === "ON"
                          ? "linear-gradient(135deg, #10B981, #34D399)"
                          : "linear-gradient(135deg, #6B7280, #9CA3AF)",
                      boxShadow:
                        pumpStatus === "ON"
                          ? "0 6px 16px rgba(16, 185, 129, 0.3)"
                          : "0 6px 16px rgba(107, 114, 128, 0.3)",
                    }}
                  >
                    <Zap
                      className={`${is320 ? "h-3 w-3" : "h-5 w-5"} text-white ${
                        pumpStatus === "ON" ? "animate-pulse" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
                <CardContent className={is320 ? "p-2" : ""}>
                  <div
                    className={`${is320 ? "text-xl" : "text-3xl"} font-bold ${
                      pumpStatus === "ON" ? "text-green-600" : "text-gray-600"
                    } ${is320 ? "mb-2" : "mb-3"}`}
                  >
                    {pumpStatus}
                  </div>
                  <div
                    className={`flex items-center ${
                      is320 ? "space-x-2 mb-2" : "space-x-3 mb-3"
                    }`}
                  >
                    <Badge
                      variant={pumpStatus === "ON" ? "default" : "outline"}
                      className={`${
                        pumpStatus === "ON"
                          ? "bg-green-100 text-green-800 shadow-sm font-semibold animate-pulse"
                          : "bg-gray-100 text-gray-600 shadow-sm font-semibold"
                      } ${is320 ? "px-2 py-0 text-xs" : "px-3 py-1"}`}
                    >
                      {pumpStatus === "ON" ? "ACTIVE" : "STANDBY"}
                    </Badge>
                    <div
                      className={`${is320 ? "w-2 h-2" : "w-3 h-3"} rounded-full ${
                        pumpStatus === "ON"
                          ? "bg-green-500 animate-pulse shadow-green-300"
                          : "bg-gray-400"
                      } shadow-lg`}
                    ></div>
                  </div>
                  <p
                    className={`${
                      is320 ? "text-xs" : "text-sm"
                    } text-gray-600 mb-1`}
                  >
                    {pumpStatus === "ON"
                      ? "Auto-activated by trend"
                      : "Smart monitoring"}
                  </p>
                  <div
                    className={`flex items-center justify-between ${
                      is320 ? "pt-1" : "pt-2"
                    } border-t border-gray-200`}
                  >
                    <span
                      className={`${is320 ? "text-xs" : "text-xs"} text-gray-500`}
                    >
                      AI Logic
                    </span>
                    <span
                      className={`${
                        is320 ? "text-xs" : "text-xs"
                      } font-medium text-blue-600`}
                    >
                      {waterLevelHistory.length > 3
                        ? "Trend Analysis"
                        : "Learning..."}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div
              className={`grid grid-cols-1 ${
                isSmallMobile ? "" : "xl:grid-cols-3"
              } ${is320 ? "gap-4 mb-4" : "gap-8 mb-8"}`}
            >
              {/* Live Tank Visualization */}
              <Card
                className={`${
                  isSmallMobile ? "" : "xl:col-span-1"
                } glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 border-white/30`}
              >
                <CardHeader className={is320 ? "p-3" : ""}>
                  <CardTitle
                    className={`${
                      is320 ? "text-lg" : "text-xl"
                    } font-bold text-gray-900 flex items-center justify-between`}
                  >
                    <div className="flex items-center">
                      <Droplets
                        className={`${
                          is320 ? "w-5 h-5" : "w-6 h-6"
                        } mr-3 text-blue-600`}
                      />
                      {is320 ? "Live Tank" : "Live Water Tank"}
                    </div>
                    <Badge
                      className={`bg-green-100 text-green-800 ${
                        is320 ? "text-xs" : "text-xs"
                      } animate-pulse`}
                    >
                      Real-time
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className={is320 ? "p-3" : ""}>
                  <TankVisualization
                    waterLevel={waterData.waterLevel}
                    tankCapacity={waterData.tankCapacity}
                    pumpStatus={waterData.pumpStatus}
                    connectionStatus={connectionStatus}
                    temperature={waterData.temperature}
                    distance={waterData.distance}
                    size={is320 ? "small" : "medium"}
                    className={is320 ? "scale-90" : ""}
                  />
                </CardContent>
              </Card>

              {/* Historical Data Chart */}
              <Card
                className={`${
                  isSmallMobile ? "" : "xl:col-span-2"
                } glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 border-white/30`}
              >
                <CardHeader className={is320 ? "p-3" : ""}>
                  <CardTitle
                    className={`${
                      is320 ? "text-lg" : "text-xl"
                    } font-bold text-gray-900 flex items-center justify-between`}
                  >
                    <div className="flex items-center">
                      <TrendingUp
                        className={`${
                          is320 ? "w-5 h-5" : "w-6 h-6"
                        } mr-3 text-blue-600`}
                      />
                      {is320 ? "History (24h)" : "ESP8266 Historical Data (24h)"}
                    </div>
                    <div
                      className={`flex items-center ${
                        is320 ? "space-x-1" : "space-x-2"
                      }`}
                    >
                      <Badge
                        variant="outline"
                        className={`${is320 ? "text-xs" : "text-xs"}`}
                      >
                        {historicalData.length} readings
                      </Badge>
                      <Badge
                        className={`bg-blue-100 text-blue-800 ${
                          is320 ? "text-xs" : "text-xs"
                        }`}
                      >
                        Live API
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className={is320 ? "p-3" : ""}>
                  <LineChart data={historicalData} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Water Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            {/* Water Usage Cards */}
            <WaterUsageCards 
              usageSummary={usageSummary}
              is320={is320}
              isSmallMobile={isSmallMobile}
            />

            {/* Usage Charts */}
            <UsageCharts 
              historicalUsage={historicalUsage}
              hourlyUsage={hourlyUsage}
              is320={is320}
              isSmallMobile={isSmallMobile}
            />

            {/* Export Button */}
            <Card className="glassmorphism shadow-xl border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Download className="w-6 h-6 mr-3 text-green-600" />
                    Export Water Usage Data
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    Excel Format
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Export comprehensive water usage data including daily, monthly, 
                    and yearly summaries with detailed analytics and insights.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="font-semibold text-blue-600">
                        {historicalUsage.length}
                      </div>
                      <div className="text-gray-600">Days of Data</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="font-semibold text-green-600">
                        {usageSummary.yearly.usage}L
                      </div>
                      <div className="text-gray-600">Total Usage (Year)</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="font-semibold text-purple-600">
                        {usageSummary.yearly.efficiency}%
                      </div>
                      <div className="text-gray-600">Avg Efficiency</div>
                    </div>
                  </div>
                  <Button 
                    onClick={handleExcelExport}
                    disabled={isExporting}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    <Download className={`w-5 h-5 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
                    {isExporting ? 'Generating Excel Report...' : 'Download Excel Report'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <Card className="glassmorphism shadow-xl border-white/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bell className="w-6 h-6 mr-3 text-blue-600" />
                    System Alerts & Notifications
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        alerts.filter((a) => !a.resolved).length > 0
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {alerts.filter((a) => !a.resolved).length} Active
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 animate-pulse">
                      Live monitoring
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-start ${
                        is320 ? "space-x-3 p-3" : "space-x-4 p-5"
                      } rounded-xl glassmorphism shadow-sm hover:shadow-md transition-all duration-200 border-white/20`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {alert.type === "danger" && (
                          <div
                            className={`${
                              is320 ? "p-2" : "p-3"
                            } rounded-full bg-red-100 border-2 border-red-200 shadow-md`}
                          >
                            <AlertTriangle
                              className={`${
                                is320 ? "w-4 h-4" : "w-5 h-5"
                              } text-red-600`}
                            />
                          </div>
                        )}
                        {alert.type === "warning" && (
                          <div
                            className={`${
                              is320 ? "p-2" : "p-3"
                            } rounded-full bg-orange-100 border-2 border-orange-200 shadow-md`}
                          >
                            <AlertTriangle
                              className={`${
                                is320 ? "w-4 h-4" : "w-5 h-5"
                              } text-orange-600`}
                            />
                          </div>
                        )}
                        {alert.type === "info" && (
                          <div
                            className={`${
                              is320 ? "p-2" : "p-3"
                            } rounded-full bg-blue-100 border-2 border-blue-200 shadow-md`}
                          >
                            <Bell
                              className={`${
                                is320 ? "w-4 h-4" : "w-5 h-5"
                              } text-blue-600`}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`${
                            is320 ? "text-xs" : "text-sm"
                          } font-semibold text-gray-900 mb-1`}
                        >
                          {alert.message}
                        </p>
                        <p
                          className={`${
                            is320 ? "text-xs" : "text-xs"
                          } text-gray-500`}
                        >
                          {alert.timestamp}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <Badge
                          variant={alert.resolved ? "outline" : "destructive"}
                          className={`${
                            alert.resolved
                              ? "border-green-300 text-green-700 bg-green-50 font-semibold"
                              : alert.type === "danger"
                              ? "bg-red-100 text-red-800 border-2 border-red-200 font-semibold"
                              : "bg-orange-100 text-orange-800 border-2 border-orange-200 font-semibold"
                          } ${is320 ? "px-2 py-0 text-xs" : "px-3 py-1"}`}
                        >
                          {alert.resolved ? "Resolved" : "Active"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer
        className={`bg-white/40 backdrop-blur-md border-t border-white/30 ${
          is320 ? "px-2 py-3" : "px-4 sm:px-6 py-6"
        } mt-8 relative z-10`}
      >
        <div className="max-w-7xl mx-auto">
          <div
            className={`flex ${
              is320
                ? "flex-col space-y-2"
                : "flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0"
            }`}
          >
            <p
              className={`${
                is320 ? "text-xs" : "text-sm"
              } font-semibold text-gray-700 text-center ${
                is320 ? "" : "md:text-left"
              }`}
            >
              © 2025 IoT Water Monitor —{" "}
              <span className="font-bold text-blue-600">
                Idris {is320 ? "Olawale" : "Ogundele Olawale"}
              </span>{" "}
              | {is320 ? "222956" : "Matric No: 222956"}
            </p>
            <div
              className={`flex ${
                is320 ? "flex-col space-y-1" : "items-center space-x-4"
              } ${is320 ? "text-xs" : "text-xs"} text-gray-600`}
            >
              <div className="flex items-center justify-center">
                <div
                  className={`${
                    is320 ? "w-1.5 h-1.5" : "w-2 h-2"
                  } rounded-full mr-2 ${
                    connectionStatus === "connected" && isOnline
                      ? "bg-green-500 animate-pulse"
                      : !isOnline
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                ></div>
                ESP8266{" "}
                {connectionStatus === "connected" && isOnline ? "Online" : !isOnline ? "Offline Mode" : "Offline"}
              </div>
              {!is320 && <div>Channel: 3035826</div>}
              <div className="flex items-center justify-center">
                <Clock className={`${is320 ? "w-2 h-2" : "w-3 h-3"} mr-1`} />
                {isOnline ? "Live API" : "Cached"}
              </div>
              {!is320 && <div>Last Update: {waterData.lastUpdate}</div>}
              {isPWAMode() && (
                <div className="flex items-center justify-center">
                  <span className={`${is320 ? "text-xs" : "text-xs"} text-blue-600 font-medium`}>
                    📱 PWA Mode
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
      
      {/* PWA Install Prompt */}
      {showPWAPrompt && (
        <PWAInstallPrompt
          onInstall={handlePWAInstall}
          onDismiss={handlePWADismiss}
        />
      )}

      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        richColors
        closeButton
      />
    </div>
  );
}