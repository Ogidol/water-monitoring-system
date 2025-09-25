// Modern Excel Export Service for IoT Water Tank Monitoring System
// Generates professional Excel dashboard with detailed water usage tracking

import { WaterLevelData, HistoricalData } from './thingspeakService';
import { UsageSummary, WaterUsageData } from './usageService';

interface ExportResult {
  success: boolean;
  filename?: string;
  error?: string;
}

class ExcelExportService {
  private generateTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
           now.toTimeString().split(' ')[0].replace(/:/g, '');
  }

  private formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  private formatDateTime(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private getAlertStatus(waterLevel: number, pumpStatus: string): string {
    if (waterLevel < 10) return 'Critical Low Water';
    if (waterLevel < 20) return 'Low Water';
    if (waterLevel > 95) return 'Tank Full';
    if (pumpStatus === 'ON' && waterLevel > 85) return 'Pump Override';
    return 'Normal';
  }

  private calculateUsageSinceLastReading(currentLevel: number, previousLevel: number, tankCapacity: number): number {
    if (previousLevel <= currentLevel) return 0; // No usage or tank was refilled
    const levelDifference = previousLevel - currentLevel;
    return Math.round((levelDifference / 100) * tankCapacity);
  }

  async exportToExcel(
    waterData: WaterLevelData,
    historicalData: HistoricalData[],
    usageSummary: UsageSummary,
    historicalUsage: WaterUsageData[]
  ): Promise<ExportResult> {
    try {
      // Dynamic import for xlsx to reduce bundle size
      const XLSX = await import('xlsx');
      
      const workbook = XLSX.utils.book_new();
      const timestamp = this.generateTimestamp();

      // Sheet 1: Raw Data
      this.createRawDataSheet(workbook, XLSX, historicalData, waterData);

      // Sheet 2: Daily Usage Summary
      this.createDailyUsageSheet(workbook, XLSX, historicalUsage);

      // Sheet 3: Monthly Usage Summary
      this.createMonthlyUsageSheet(workbook, XLSX, historicalUsage);

      // Sheet 4: Yearly Usage Summary
      this.createYearlyUsageSheet(workbook, XLSX, historicalUsage);

      // Generate and save the Excel file
      const filename = `IoT_WaterTank_Dashboard_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, filename);

      return {
        success: true,
        filename: filename
      };

    } catch (error) {
      console.error('Excel export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  private createRawDataSheet(workbook: any, XLSX: any, historicalData: HistoricalData[], waterData: WaterLevelData) {
    const rawData = [
      // Header Section with Water Theme
      ['💧 IoT Water Tank Monitoring System - Raw Data', '', '', '', ''],
      ['Report Generated:', this.formatDateTime(new Date()), '', '', ''],
      ['ThingSpeak Channel ID:', '3035826', '', '', ''],
      ['Current Tank Capacity:', `${waterData.tankCapacity} Liters`, '', '', ''],
      ['', '', '', '', ''],
      
      // Data Table Headers with Water Drop Icons
      ['Date/Time', '💧 Water Level (L)', '📊 Usage Since Last Reading (L)', 'Pump Status (ON/OFF)', 'Alert/Status'],
      
      // Generate raw data rows
      ...this.generateRawDataRows(historicalData, waterData)
    ];

    const rawSheet = XLSX.utils.aoa_to_sheet(rawData);
    
    // Set column widths for professional appearance
    rawSheet['!cols'] = [
      { width: 18 }, // Date/Time
      { width: 18 }, // Water Level
      { width: 25 }, // Usage Since Last
      { width: 18 }, // Pump Status
      { width: 18 }  // Alert/Status
    ];

    // Apply professional styling
    this.applySheetStyling(rawSheet, 'Raw Data', XLSX);
    
    XLSX.utils.book_append_sheet(workbook, rawSheet, 'Raw Data');
  }

  private generateRawDataRows(historicalData: HistoricalData[], waterData: WaterLevelData): any[] {
    const rows: any[] = [];
    
    // Add current data as first row with example format
    const currentVolume = Math.round((waterData.waterLevel / 100) * waterData.tankCapacity);
    rows.push([
      `${this.formatDate(new Date())} 08:00`,
      currentVolume,
      '–', // No previous reading for current
      waterData.pumpStatus,
      this.getAlertStatus(waterData.waterLevel, waterData.pumpStatus)
    ]);

    // Process historical data to create realistic raw data entries
    for (let i = 0; i < Math.min(historicalData.length, 100); i++) { // Limit to 100 entries for clarity
      const current = historicalData[i];
      const previous = i > 0 ? historicalData[i - 1] : null;
      
      const currentVolume = Math.round((current.level / 100) * waterData.tankCapacity);
      const usageSinceLastReading = previous 
        ? this.calculateUsageSinceLastReading(current.level, previous.level, waterData.tankCapacity)
        : 0;

      // Determine pump status based on level changes
      const pumpStatus = (previous && current.level > previous.level + 2) ? 'ON' : 'OFF';
      
      // Format time for Excel display
      const timeFormatted = new Date(current.time).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      rows.push([
        timeFormatted,
        currentVolume,
        usageSinceLastReading > 0 ? usageSinceLastReading : '–',
        pumpStatus,
        this.getAlertStatus(current.level, pumpStatus)
      ]);
    }

    return rows;
  }

  private createDailyUsageSheet(workbook: any, XLSX: any, historicalUsage: WaterUsageData[]) {
    const dailyData = [
      // Header Section with professional styling
      ['📊 Daily Water Usage Summary', ''],
      ['Analysis Period:', `${historicalUsage.length} Days`],
      ['Generated:', this.formatDateTime(new Date())],
      ['', ''],
      
      // Table Headers with water theme
      ['Date', '💧 Total Usage (L)'],
      
      // Daily usage data
      ...historicalUsage.map(day => [
        this.formatDate(day.date),
        Math.round(day.dailyUsage)
      ]),

      // Summary Statistics Section
      ['', ''],
      ['📈 SUMMARY STATISTICS', ''],
      ['Total Days Analyzed:', historicalUsage.length],
      ['Average Daily Usage:', Math.round(historicalUsage.reduce((sum, day) => sum + day.dailyUsage, 0) / historicalUsage.length) + ' L'],
      ['Highest Daily Usage:', Math.max(...historicalUsage.map(day => day.dailyUsage)) + ' L'],
      ['Lowest Daily Usage:', Math.min(...historicalUsage.map(day => day.dailyUsage)) + ' L'],
      ['Total Usage Period:', Math.round(historicalUsage.reduce((sum, day) => sum + day.dailyUsage, 0)) + ' L'],
      ['', ''],
      ['🎯 EFFICIENCY METRICS', ''],
      ['Average Efficiency:', Math.round(historicalUsage.reduce((sum, day) => sum + day.efficiency, 0) / historicalUsage.length) + '%'],
      ['Best Efficiency Day:', Math.max(...historicalUsage.map(day => day.efficiency)) + '%'],
      ['Efficiency Trend:', this.calculateTrend(historicalUsage.map(day => day.efficiency))]
    ];

    const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
    
    dailySheet['!cols'] = [
      { width: 15 }, // Date
      { width: 20 }  // Usage
    ];

    this.applySheetStyling(dailySheet, 'Daily Usage', XLSX);
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Usage Summary');
  }

  private createMonthlyUsageSheet(workbook: any, XLSX: any, historicalUsage: WaterUsageData[]) {
    // Group data by month
    const monthlyGroups: { [key: string]: WaterUsageData[] } = {};
    historicalUsage.forEach(day => {
      const monthKey = day.date.substring(0, 7); // YYYY-MM format
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = [];
      }
      monthlyGroups[monthKey].push(day);
    });

    const monthlyData = [
      // Header Section with sustainability theme
      ['📅 Monthly Water Usage Summary', ''],
      ['🌱 Sustainability Dashboard', ''],
      ['Analysis Period:', `${Object.keys(monthlyGroups).length} Months`],
      ['Generated:', this.formatDateTime(new Date())],
      ['', ''],
      
      // Table Headers with green theme for sustainability
      ['Month', '💧 Total Usage (L)'],
      
      // Monthly usage data
      ...Object.entries(monthlyGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, days]) => {
          const totalUsage = days.reduce((sum, day) => sum + day.dailyUsage, 0);
          const monthName = new Date(month + '-01').toLocaleDateString('en-GB', { 
            year: 'numeric', 
            month: 'long' 
          });
          return [monthName, Math.round(totalUsage)];
        }),

      // Monthly Statistics Section
      ['', ''],
      ['📈 MONTHLY STATISTICS', ''],
      ['Total Months Analyzed:', Object.keys(monthlyGroups).length],
      ['Average Monthly Usage:', Math.round(
        Object.values(monthlyGroups).reduce((sum, days) => 
          sum + days.reduce((daySum, day) => daySum + day.dailyUsage, 0), 0
        ) / Object.keys(monthlyGroups).length
      ) + ' L'],
      ['Highest Monthly Usage:', Math.max(
        ...Object.values(monthlyGroups).map(days => 
          days.reduce((sum, day) => sum + day.dailyUsage, 0)
        )
      ) + ' L'],
      ['Lowest Monthly Usage:', Math.min(
        ...Object.values(monthlyGroups).map(days => 
          days.reduce((sum, day) => sum + day.dailyUsage, 0)
        )
      ) + ' L'],
      ['Total Usage All Months:', Math.round(
        Object.values(monthlyGroups).reduce((sum, days) => 
          sum + days.reduce((daySum, day) => daySum + day.dailyUsage, 0), 0
        )
      ) + ' L'],
      ['', ''],
      ['🌿 SUSTAINABILITY METRICS', ''],
      ['Water Saved vs Average:', this.calculateWaterSaved(
        Object.values(monthlyGroups).reduce((sum, days) => 
          sum + days.reduce((daySum, day) => daySum + day.dailyUsage, 0), 0
        ), 
        Object.values(monthlyGroups).reduce((sum, days) => sum + days.length, 0)
      ) + ' L'],
      ['Conservation Rating:', this.getConservationRating(
        Object.values(monthlyGroups).reduce((sum, days) => 
          sum + days.reduce((daySum, day) => daySum + day.dailyUsage, 0), 0
        ) / Object.keys(monthlyGroups).length
      )]
    ];

    const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData);
    
    monthlySheet['!cols'] = [
      { width: 20 }, // Month
      { width: 20 }  // Usage
    ];

    this.applySheetStyling(monthlySheet, 'Monthly Usage', XLSX);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Usage Summary');
  }

  private createYearlyUsageSheet(workbook: any, XLSX: any, historicalUsage: WaterUsageData[]) {
    // Group data by year
    const yearlyGroups: { [key: string]: WaterUsageData[] } = {};
    historicalUsage.forEach(day => {
      const year = day.date.substring(0, 4); // YYYY format
      if (!yearlyGroups[year]) {
        yearlyGroups[year] = [];
      }
      yearlyGroups[year].push(day);
    });

    const yearlyData = [
      // Header Section with long-term focus
      ['🗓️ Yearly Water Usage Summary', ''],
      ['🏆 Long-term Water Management Dashboard', ''],
      ['Analysis Period:', `${Object.keys(yearlyGroups).length} Year(s)`],
      ['Generated:', this.formatDateTime(new Date())],
      ['', ''],
      
      // Table Headers
      ['Year', '💧 Total Usage (L)'],
      
      // Yearly usage data
      ...Object.entries(yearlyGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, days]) => {
          const totalUsage = days.reduce((sum, day) => sum + day.dailyUsage, 0);
          return [year, Math.round(totalUsage)];
        }),

      // Yearly Statistics Section
      ['', ''],
      ['📈 YEARLY STATISTICS', ''],
      ['Total Years Analyzed:', Object.keys(yearlyGroups).length],
      ['Average Yearly Usage:', Math.round(
        Object.values(yearlyGroups).reduce((sum, days) => 
          sum + days.reduce((daySum, day) => daySum + day.dailyUsage, 0), 0
        ) / Object.keys(yearlyGroups).length
      ) + ' L'],
      ['Current Year Usage:', (() => {
        const currentYear = new Date().getFullYear().toString();
        const currentYearData = yearlyGroups[currentYear];
        return currentYearData 
          ? Math.round(currentYearData.reduce((sum, day) => sum + day.dailyUsage, 0)) + ' L'
          : 'No data';
      })()],
      ['Projected Annual Usage:', (() => {
        const currentYear = new Date().getFullYear().toString();
        const currentYearData = yearlyGroups[currentYear];
        if (currentYearData && currentYearData.length > 0) {
          const currentUsage = currentYearData.reduce((sum, day) => sum + day.dailyUsage, 0);
          const daysInYear = 365;
          const projectedUsage = (currentUsage / currentYearData.length) * daysInYear;
          return Math.round(projectedUsage) + ' L (estimated)';
        }
        return 'Insufficient data';
      })()],
      ['Total All Years:', Math.round(
        Object.values(yearlyGroups).reduce((sum, days) => 
          sum + days.reduce((daySum, day) => daySum + day.dailyUsage, 0), 0
        )
      ) + ' L'],
      ['', ''],
      ['🎯 PERFORMANCE INDICATORS', ''],
      ['Usage Efficiency Trend:', this.calculateYearlyTrend(yearlyGroups)],
      ['Best Performing Year:', this.getBestYear(yearlyGroups)],
      ['Annual Growth Rate:', this.calculateGrowthRate(yearlyGroups) + '%']
    ];

    const yearlySheet = XLSX.utils.aoa_to_sheet(yearlyData);
    
    yearlySheet['!cols'] = [
      { width: 15 }, // Year
      { width: 25 }  // Usage
    ];

    this.applySheetStyling(yearlySheet, 'Yearly Usage', XLSX);
    XLSX.utils.book_append_sheet(workbook, yearlySheet, 'Yearly Usage Summary');
  }

  private applySheetStyling(sheet: any, sheetType: string, XLSX: any) {
    // Set row heights for better readability
    if (!sheet['!rows']) sheet['!rows'] = [];
    
    // Header row styling
    sheet['!rows'][0] = { hpt: 25 }; // Header height
    if (sheet['!rows'][5]) sheet['!rows'][5] = { hpt: 20 }; // Table header height
    
    // Freeze panes to keep headers visible
    sheet['!freeze'] = { xSplit: 0, ySplit: 6 };
    
    // Auto-filter for data tables
    if (sheet['!ref']) {
      const range = XLSX.utils.decode_range(sheet['!ref']);
      sheet['!autofilter'] = { ref: sheet['!ref'] };
    }
  }

  // Helper methods for calculations
  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'Insufficient data';
    const recent = values.slice(-7);
    const previous = values.slice(-14, -7);
    if (recent.length === 0 || previous.length === 0) return 'Stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const previousAvg = previous.reduce((sum, val) => sum + val, 0) / previous.length;
    
    if (recentAvg > previousAvg * 1.05) return 'Improving';
    if (recentAvg < previousAvg * 0.95) return 'Declining';
    return 'Stable';
  }

  private calculateWaterSaved(totalUsage: number, totalDays: number): number {
    const averageUsage = 150; // L per day baseline
    const expectedUsage = totalDays * averageUsage;
    return Math.max(0, Math.round(expectedUsage - totalUsage));
  }

  private getConservationRating(monthlyAverage: number): string {
    if (monthlyAverage < 3000) return 'Excellent';
    if (monthlyAverage < 4500) return 'Good';
    if (monthlyAverage < 6000) return 'Fair';
    return 'Needs Improvement';
  }

  private calculateYearlyTrend(yearlyGroups: { [key: string]: WaterUsageData[] }): string {
    const years = Object.keys(yearlyGroups).sort();
    if (years.length < 2) return 'Insufficient data';
    
    const yearlyUsages = years.map(year => 
      yearlyGroups[year].reduce((sum, day) => sum + day.dailyUsage, 0)
    );
    
    const firstHalf = yearlyUsages.slice(0, Math.floor(yearlyUsages.length / 2));
    const secondHalf = yearlyUsages.slice(Math.floor(yearlyUsages.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) return 'Increasing';
    if (secondAvg < firstAvg * 0.9) return 'Decreasing';
    return 'Stable';
  }

  private getBestYear(yearlyGroups: { [key: string]: WaterUsageData[] }): string {
    let bestYear = '';
    let bestEfficiency = 0;
    
    Object.entries(yearlyGroups).forEach(([year, days]) => {
      const avgEfficiency = days.reduce((sum, day) => sum + day.efficiency, 0) / days.length;
      if (avgEfficiency > bestEfficiency) {
        bestEfficiency = avgEfficiency;
        bestYear = year;
      }
    });
    
    return bestYear ? `${bestYear} (${Math.round(bestEfficiency)}% efficiency)` : 'N/A';
  }

  private calculateGrowthRate(yearlyGroups: { [key: string]: WaterUsageData[] }): string {
    const years = Object.keys(yearlyGroups).sort();
    if (years.length < 2) return 'N/A';
    
    const firstYear = yearlyGroups[years[0]].reduce((sum, day) => sum + day.dailyUsage, 0);
    const lastYear = yearlyGroups[years[years.length - 1]].reduce((sum, day) => sum + day.dailyUsage, 0);
    
    const growthRate = ((lastYear - firstYear) / firstYear) * 100 / (years.length - 1);
    return growthRate.toFixed(1);
  }
}

export default new ExcelExportService();