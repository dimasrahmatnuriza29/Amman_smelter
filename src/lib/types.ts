export interface KpiData {
  avgHealth: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  totalMachines: number;
  anomalyCount: number;
  totalReadings: number;
}

export interface Asset {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  HEALTH_PCT: number;
  HEALTH_STATUS: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  OPERATIONAL_TIME: number;
  IS_RUNNING: boolean;
  AVG_DEVIATION_PCT: number;
  TIMESTAMP: string;
  HEALTH_PAST_AGO: number;
  TREND_PCT: number;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
  ANOMALY_HISTORY_COUNT: number;
  TEMP_ANOMALY_COUNT: number;
  VIB_ANOMALY_COUNT: number;
  PRESS_ANOMALY_COUNT: number;
  FIRST_ANOMALY_TS: string | null;
  LAST_ANOMALY_TS: string | null;
}

export interface AssetDetail extends Asset {
  TEMP_DEVIATION_PCT: number;
  VIB_DEVIATION_PCT: number;
  PRESS_DEVIATION_PCT: number;
  RUL_DAYS: number;
}

export interface TrendPoint {
  TIMESTAMP: string;
  TEMPERATURE: number;
  VIBRATION: number;
  PRESSURE: number;
  HEALTH_PCT: number;
  IS_ANOMALY: boolean;
  IS_TEMPERATURE_ANOMALY: boolean;
  IS_VIBRATION_ANOMALY: boolean;
  IS_PRESSURE_ANOMALY: boolean;
}

export interface AnomalySummary {
  MACHINE_ID: string;
  MACHINE_TYPE: string;
  ANOMALY_COUNT: number;
  MAX_SCORE: number;
  AVG_SCORE: number;
  LATEST_ANOMALY_TS: number;
  TEMP_ANOMALY_COUNT: number;
  VIB_ANOMALY_COUNT: number;
  PRESS_ANOMALY_COUNT: number;
}

export interface AnomalyDetail {
  TIMESTAMP: number;
  MACHINE_ID: string;
  ANOMALY_SCORE: number;
  IS_ANOMALY: boolean;
}
