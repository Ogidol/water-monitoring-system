// Water Usage Service - Tracks water consumption and intake
export interface WaterUsageData {
  date: string;
  dailyUsage: number; // Liters consumed
  dailyIntake: number; // Liters added to tank
  hourlyUsage: number[];
  pumpRunTime: number; // Minutes pump was active
  efficiency: number; // Percentage efficiency
}

export interface UsageSummary {
  daily: {
    usage: number;
    intake: number;
    net: number; // intake - usage
    efficiency: number;
  };
  monthly: {
    usage: number;
    intake: number;
    net: number;
    efficiency: number;
    averageDaily: number;
  };
  yearly: {
    usage: number;
    intake: number;
    net: number;
    efficiency: number;
    averageDaily: number;
    averageMonthly: number;
  };
}

class WaterUsageService {
  private usageData: WaterUsageData[] = [];
  private readonly STORAGE_KEY = 'water_usage_data';

  constructor() {
    this.loadStoredData();
    this.generateMockData(); // For demonstration
  }

  // Generate realistic mock data for the past year
  private generateMockData() {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    for (let date = new Date(oneYearAgo); date <= now; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      // Simulate seasonal usage patterns
      const month = date.getMonth();
      const isWinter = month >= 11 || month <= 2;
      const isSummer = month >= 5 && month <= 8;
      
      let baseUsage = 150; // Base daily usage in liters
      if (isSummer) baseUsage *= 1.4; // Higher usage in summer
      if (isWinter) baseUsage *= 0.8; // Lower usage in winter
      
      // Add some randomness
      const dailyUsage = baseUsage + (Math.random() - 0.5) * 40;
      const dailyIntake = dailyUsage + (Math.random() - 0.3) * 30; // Slightly more intake
      
      // Generate hourly usage pattern (more usage during day)
      const hourlyUsage = Array.from({ length: 24 }, (_, hour) => {
        let hourlyFactor = 1;
        if (hour >= 6 && hour <= 10) hourlyFactor = 1.8; // Morning peak
        if (hour >= 18 && hour <= 22) hourlyFactor = 1.6; // Evening peak
        if (hour >= 0 && hour <= 5) hourlyFactor = 0.2; // Night low
        
        return (dailyUsage / 24) * hourlyFactor * (0.7 + Math.random() * 0.6);
      });
      
      this.usageData.push({
        date: dateStr,
        dailyUsage: Math.round(dailyUsage),
        dailyIntake: Math.round(dailyIntake),
        hourlyUsage,
        pumpRunTime: Math.round(30 + Math.random() * 90), // 30-120 minutes
        efficiency: Math.round(85 + Math.random() * 10), // 85-95% efficiency
      });
    }
    
    // Keep only last 365 days
    this.usageData = this.usageData.slice(-365);
    this.saveData();
  }

  // Add new usage data point (called when water level changes)
  public addUsagePoint(waterLevel: number, tankCapacity: number, pumpStatus: string) {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    
    let todayData = this.usageData.find(d => d.date === today);
    
    if (!todayData) {
      todayData = {
        date: today,
        dailyUsage: 0,
        dailyIntake: 0,
        hourlyUsage: new Array(24).fill(0),
        pumpRunTime: 0,
        efficiency: 90,
      };
      this.usageData.push(todayData);
    }
    
    // More realistic usage tracking based on actual water level changes
    // Store previous level to calculate actual consumption
    const storageKey = 'last_water_level';
    const lastLevel = parseFloat(localStorage.getItem(storageKey) || waterLevel.toString());
    const levelDifference = lastLevel - waterLevel; // Positive if water was consumed
    
    if (levelDifference > 0.5) { // Only count significant decreases as usage
      const volumeUsed = (levelDifference / 100) * tankCapacity;
      todayData.hourlyUsage[currentHour] += Math.min(volumeUsed, 50); // Cap at 50L per update
      todayData.dailyUsage = todayData.hourlyUsage.reduce((sum, usage) => sum + usage, 0);
    }
    
    if (pumpStatus === 'ON') {
      // More realistic intake calculation
      const intakeRate = 2; // Liters per minute
      const intakeAmount = intakeRate * 0.05; // 3 seconds worth
      todayData.dailyIntake += intakeAmount;
      todayData.pumpRunTime += 0.05; // 3 seconds in minutes
    }
    
    // Update efficiency based on actual intake/usage ratio
    if (todayData.dailyUsage > 0) {
      todayData.efficiency = Math.min(95, Math.round((todayData.dailyIntake / todayData.dailyUsage) * 100));
    }
    
    // Store current level for next comparison
    localStorage.setItem(storageKey, waterLevel.toString());
    
    this.saveData();
  }

  // Get usage summary for different periods
  public getUsageSummary(): UsageSummary {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const thisYear = now.getFullYear().toString();
    
    // Daily (today)
    const dailyData = this.usageData.find(d => d.date === today) || {
      dailyUsage: 0, dailyIntake: 0, efficiency: 0
    };
    
    // Monthly (this month)
    const monthlyData = this.usageData.filter(d => d.date.startsWith(thisMonth));
    const monthlyUsage = monthlyData.reduce((sum, d) => sum + d.dailyUsage, 0);
    const monthlyIntake = monthlyData.reduce((sum, d) => sum + d.dailyIntake, 0);
    const monthlyEfficiency = monthlyData.length > 0 
      ? monthlyData.reduce((sum, d) => sum + d.efficiency, 0) / monthlyData.length 
      : 0;
    
    // Yearly (this year)
    const yearlyData = this.usageData.filter(d => d.date.startsWith(thisYear));
    const yearlyUsage = yearlyData.reduce((sum, d) => sum + d.dailyUsage, 0);
    const yearlyIntake = yearlyData.reduce((sum, d) => sum + d.dailyIntake, 0);
    const yearlyEfficiency = yearlyData.length > 0 
      ? yearlyData.reduce((sum, d) => sum + d.efficiency, 0) / yearlyData.length 
      : 0;
    
    return {
      daily: {
        usage: Math.round(dailyData.dailyUsage),
        intake: Math.round(dailyData.dailyIntake),
        net: Math.round(dailyData.dailyIntake - dailyData.dailyUsage),
        efficiency: Math.round(dailyData.efficiency),
      },
      monthly: {
        usage: Math.round(monthlyUsage),
        intake: Math.round(monthlyIntake),
        net: Math.round(monthlyIntake - monthlyUsage),
        efficiency: Math.round(monthlyEfficiency),
        averageDaily: Math.round(monthlyUsage / Math.max(1, monthlyData.length)),
      },
      yearly: {
        usage: Math.round(yearlyUsage),
        intake: Math.round(yearlyIntake),
        net: Math.round(yearlyIntake - yearlyUsage),
        efficiency: Math.round(yearlyEfficiency),
        averageDaily: Math.round(yearlyUsage / Math.max(1, yearlyData.length)),
        averageMonthly: Math.round(yearlyUsage / 12),
      },
    };
  }

  // Get historical usage data for charts
  public getHistoricalUsage(days: number = 30): WaterUsageData[] {
    return this.usageData.slice(-days);
  }

  // Get hourly usage for today
  public getTodayHourlyUsage(): number[] {
    const today = new Date().toISOString().split('T')[0];
    const todayData = this.usageData.find(d => d.date === today);
    return todayData?.hourlyUsage || new Array(24).fill(0);
  }

  // Export data for Excel
  public getExportData() {
    return {
      summary: this.getUsageSummary(),
      historical: this.usageData,
      hourlyToday: this.getTodayHourlyUsage(),
    };
  }

  private loadStoredData() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.usageData = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored usage data:', error);
    }
  }

  private saveData() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.usageData));
    } catch (error) {
      console.warn('Failed to save usage data:', error);
    }
  }

  // Clear all data (for testing)
  public clearData() {
    this.usageData = [];
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export default new WaterUsageService();