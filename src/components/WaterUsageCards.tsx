import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  Droplets,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Target,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { UsageSummary } from "../services/usageService";

interface WaterUsageCardsProps {
  usageSummary: UsageSummary;
  isSmallMobile?: boolean;
}

export function WaterUsageCards({
  usageSummary,
  isSmallMobile,
}: WaterUsageCardsProps) {
  // Detect if screen width is 320px or less
  const is320 =
    typeof window !== "undefined" ? window.innerWidth <= 320 : false;

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous * 1.1)
      return <ArrowUp className="w-3 h-3 text-red-500" />;
    if (current < previous * 0.9)
      return <ArrowDown className="w-3 h-3 text-green-500" />;
    return <Minus className="w-3 h-3 text-gray-500" />;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600";
    if (efficiency >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getNetChangeColor = (net: number) => {
    if (net > 0) return "text-green-600";
    if (net < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {/* Daily Usage Card */}
      <Card
        className={`glassmorphism shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-white/30 ${
          isSmallMobile ? "p-2" : ""
        }`}
      >
        <CardHeader
          className={`flex flex-row items-center justify-between space-y-0 ${
            isSmallMobile ? "pb-2" : "pb-3"
          }`}
        >
          <CardTitle
            className={`${
              is320 ? "text-xs" : "text-sm"
            } font-semibold text-gray-700`}
          >
            Daily Usage
          </CardTitle>
          <div
            className={`${isSmallMobile ? "p-2" : "p-3"} rounded-xl shadow-lg`}
            style={{
              background: "linear-gradient(135deg, #3B82F6, #60A5FA)",
              boxShadow: "0 6px 16px rgba(59, 130, 246, 0.3)",
            }}
          >
            <Calendar
              className={`${isSmallMobile ? "h-3 w-3" : "h-5 w-5"} text-white`}
            />
          </div>
        </CardHeader>
        <CardContent className={isSmallMobile ? "p-2" : ""}>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1">
            {usageSummary.daily.usage}L
          </div>
          <div
            className={`flex items-center justify-between ${
              isSmallMobile ? "mb-2" : "mb-3"
            }`}
          >
            <span
              className={`${
                isSmallMobile ? "text-xs" : "text-sm"
              } text-gray-600`}
            >
              Added: {usageSummary.daily.intake}L
            </span>
            <Badge
              variant={usageSummary.daily.net >= 0 ? "default" : "destructive"}
              className={`${
                usageSummary.daily.net >= 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              } ${isSmallMobile ? "text-xs" : "text-xs"}`}
            >
              {usageSummary.daily.net >= 0 ? "+" : ""}
              {usageSummary.daily.net}L
            </Badge>
          </div>
          <div
            className={`flex items-center justify-between ${
              isSmallMobile ? "text-xs" : "text-sm"
            } text-gray-600`}
          >
            <span>Efficiency</span>
            <span
              className={`font-semibold ${getEfficiencyColor(
                usageSummary.daily.efficiency
              )}`}
            >
              {usageSummary.daily.efficiency}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Usage Card */}
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
          <CardTitle className="text-xs sm:text-sm font-semibold text-gray-700">
            Monthly Usage
          </CardTitle>
          <div
            className={`${is320 ? "p-2" : "p-3"} rounded-xl shadow-lg`}
            style={{
              background: "linear-gradient(135deg, #10B981, #34D399)",
              boxShadow: "0 6px 16px rgba(16, 185, 129, 0.3)",
            }}
          >
            <BarChart3
              className={`${is320 ? "h-3 w-3" : "h-5 w-5"} text-white`}
            />
          </div>
        </CardHeader>
        <CardContent className={is320 ? "p-2" : ""}>
          <div
            className={`${
              isSmallMobile ? "text-2xl" : "text-4xl"
            } font-bold text-gray-900 mb-1`}
          >
            {usageSummary.monthly.usage}L
          </div>
          <div
            className={`${
              isSmallMobile ? "text-xs" : "text-sm"
            } text-gray-600 mb-1`}
          >
            Avg daily: {usageSummary.monthly.averageDaily}L
          </div>
          <div
            className={`flex items-center justify-between ${
              isSmallMobile ? "mb-2" : "mb-3"
            }`}
          >
            <span
              className={`${
                isSmallMobile ? "text-xs" : "text-sm"
              } text-gray-600`}
            >
              Added: {usageSummary.monthly.intake}L
            </span>
            <Badge
              variant={
                usageSummary.monthly.net >= 0 ? "default" : "destructive"
              }
              className={`${
                usageSummary.monthly.net >= 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              } ${isSmallMobile ? "text-xs" : "text-xs"}`}
            >
              {usageSummary.monthly.net >= 0 ? "+" : ""}
              {usageSummary.monthly.net}L
            </Badge>
          </div>
          <div
            className={`flex items-center justify-between ${
              isSmallMobile ? "text-xs" : "text-sm"
            } text-gray-600`}
          >
            <span>Efficiency</span>
            <span
              className={`font-semibold ${getEfficiencyColor(
                usageSummary.monthly.efficiency
              )}`}
            >
              {usageSummary.monthly.efficiency}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Yearly Usage Card */}
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
          <CardTitle className="text-xs sm:text-sm font-semibold text-gray-700">
            Yearly Usage
          </CardTitle>
          <div
            className={`${is320 ? "p-2" : "p-3"} rounded-xl shadow-lg`}
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
              boxShadow: "0 6px 16px rgba(139, 92, 246, 0.3)",
            }}
          >
            <Target
              className={`${isSmallMobile ? "h-3 w-3" : "h-5 w-5"} text-white`}
            />
          </div>
        </CardHeader>
        <CardContent className={is320 ? "p-2" : ""}>
          <div
            className={`${
              isSmallMobile ? "text-xl" : "text-3xl"
            } font-bold text-gray-900 mb-1`}
          >
            {Math.round(usageSummary.yearly.usage / 1000)}K L
          </div>
          <div
            className={`${
              isSmallMobile ? "text-xs" : "text-sm"
            } text-gray-600 mb-1`}
          >
            Avg daily: {usageSummary.yearly.averageDaily}L
          </div>
          <div
            className={`${
              isSmallMobile ? "text-xs" : "text-sm"
            } text-gray-600 mb-2`}
          >
            Avg monthly: {usageSummary.yearly.averageMonthly}L
          </div>
          <div
            className={`flex items-center justify-between ${
              isSmallMobile ? "mb-2" : "mb-3"
            }`}
          >
            <span
              className={`${
                isSmallMobile ? "text-xs" : "text-sm"
              } text-gray-600`}
            >
              Net: {usageSummary.yearly.net >= 0 ? "+" : ""}
              {Math.round(usageSummary.yearly.net)}L
            </span>
            <Badge
              className={`bg-purple-100 text-purple-800 ${
                isSmallMobile ? "text-xs" : "text-xs"
              }`}
            >
              {usageSummary.yearly.efficiency}% eff
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WaterUsageCards;
