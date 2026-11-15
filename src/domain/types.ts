/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Domain Types & Schemas
 */

export type DataQualityState = 'FRESH' | 'DEGRADED' | 'STALE' | 'QUALITY_HOLD';

export type CommodityType = 'GOLD' | 'SILVER' | 'WTI_OIL' | 'BRENT_OIL';
export type CommodityFamily = 'PRECIOUS_METALS' | 'ENERGY';

export type InstrumentId =
  | 'XAUUSD'
  | 'GC_FUT'
  | 'XAU_CFD'
  | 'GLD_ETF'
  | 'XAGUSD'
  | 'SI_FUT'
  | 'XAG_CFD'
  | 'SLV_ETF'
  | 'WTI_CRUDE'
  | 'CL_FUT'
  | 'WTI_CFD'
  | 'USO_ETF'
  | 'BRENT_CRUDE'
  | 'BZ_FUT'
  | 'BRENT_CFD'
  | 'BNO_ETF'
  | 'DXY'
  | 'US10Y'
  | 'US_TIPS10Y';

export type AssetClass = 'SPOT' | 'FUTURES' | 'CFD' | 'COMPARISON' | 'MACRO' | 'ETF';

export interface InstrumentSpecification {
  id: InstrumentId;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quoteCurrency: string;
  baseCurrency: string;
  contractMultiplier: number;
  lotIncrement: number;
  minLotSize: number;
  maxLotSize: number;
  pipSize: number;
  typicalSpreadPips: number;
  leverageMax: number;
  marginRequirementPct: number;
  overnightSwapLongAprPct: number;
  overnightSwapShortAprPct: number;
  tradingHours: string;
}

export interface Quote {
  instrumentId: InstrumentId;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
  high24h: number;
  low24h: number;
  open24h: number;
  change24hPct: number;
  volume24h: number;
  timestamp: string; // ISO UTC
  provider: string;
  quality: DataQualityState;
  latencyMs: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export interface Candle {
  timestamp: number; // Unix timestamp ms
  timeStr: string;   // ISO string UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isComplete: boolean;
}

export interface IndicatorSnapshot {
  timestamp: number;
  ema9: number;
  ema21: number;
  ema50: number;
  ema200: number;
  sma20: number;
  sma50: number;
  sma200: number;
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
  };
  atr14: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  vwap: number;
  supertrend: {
    value: number;
    direction: 'BULLISH' | 'BEARISH';
  };
  supportResistance: {
    support1: number;
    support2: number;
    pivot: number;
    resistance1: number;
    resistance2: number;
  };
}

export type MarketRegimeType =
  | 'BULLISH_TREND'
  | 'BEARISH_TREND'
  | 'RANGE_COMPRESSION'
  | 'VOLATILITY_EXPANSION'
  | 'MACRO_TRANSITION';

export interface MarketRegime {
  currentRegime: MarketRegimeType;
  confidencePct: number;
  volatilityPercentile: number; // 0 - 100
  trendStrengthAdx: number;
  macroAlignment: 'FAVORABLE' | 'NEUTRAL' | 'HEADWIND';
  summary: string;
  updatedAt: string;
}

export interface EconomicRelease {
  id: string;
  seriesName: string;
  country: string;
  period: string;
  releaseDate: string; // ISO UTC
  observedValue: number;
  priorValueAsKnown: number;
  consensusEstimate: number;
  revisedValue?: number;
  surpriseDeviation: number; // normalized surprise in standard deviations
  unit: string;
  impactOnGoldHistoric: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  source: string;
}

export interface HistoricalEventStudy {
  id: string;
  title: string;
  category: 'FOMC' | 'INFLATION_CPI' | 'LABOR_NFP' | 'GEOPOLITICAL' | 'LIQUIDITY_SHOCK';
  date: string;
  description: string;
  goldPriceBefore: number;
  returns: {
    h1: number;
    h4: number;
    d1: number;
    d5: number;
    d20: number;
  };
  mfePct: number; // Max Favorable Excursion
  maePct: number; // Max Adverse Excursion
  regimeAtEvent: MarketRegimeType;
  keyTakeaway: string;
}

export interface AnalogMatchResult {
  historicalEventId: string;
  title: string;
  date: string;
  similarityScorePct: number;
  matchingFeatures: string[];
  keyDifferences: string[];
  outcomeSummary: string;
  d5ReturnPct: number;
}

export type TradeDirection = 'BUY' | 'SELL' | 'HOLD' | 'REDUCE' | 'NO_TRADE';

export type AdvisoryHorizon = 'INTRADAY' | 'SHORT_TERM' | 'SWING' | 'LONG_TERM' | 'CFD';

export type RecommendationState =
  | 'STRONG_BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'BEARISH'
  | 'STRONG_BEARISH'
  | 'BUY_SETUP_DEVELOPING'
  | 'SELL_SETUP_DEVELOPING'
  | 'BUY_CONFIRMED'
  | 'SELL_CONFIRMED'
  | 'HOLD'
  | 'REDUCE_EXPOSURE'
  | 'EXIT_TRIGGERED'
  | 'WAIT'
  | 'NO_TRADE'
  | 'DATA_QUALITY_HOLD';

export interface TradePlan {
  id: string;
  instrumentId: InstrumentId;
  horizon: AdvisoryHorizon;
  direction: TradeDirection;
  state: RecommendationState;
  createdAt: string;
  expiryAt: string;
  currentMid: number;
  entryZoneMin: number;
  entryZoneMax: number;
  triggerPrice: number;
  stopLossPrice: number;
  target1Price: number;
  target2Price: number;
  target3Price: number;
  riskDistance: number;
  rewardDistance: number;
  rewardToRiskRatio: number;
  invalidationCondition: string;
  eventRiskWarning: string;
  isAbstained: boolean;
  abstentionReason?: string;
  snapshotHash?: string;
  version?: string;
  evalStatus?: 'PENDING' | 'TARGET1_REACHED' | 'TARGET2_REACHED' | 'STOP_LOSS_HIT' | 'INVALIDATED' | 'EXPIRED';
  outcomeTimestamp?: string;
}

export interface CFDCalculationResult {
  accountEquity: number;
  riskPercent: number;
  riskDollarAmount: number;
  entryPrice: number;
  stopLossPrice: number;
  stopDistancePoints: number;
  contractSize: number;
  recommendedLots: number;
  roundedLots: number;
  notionalExposure: number;
  requiredMargin: number;
  marginHeadroom: number;
  estimatedSpreadCost: number;
  estimatedRoundTurnCommission: number;
  estimatedDailyOvernightSwap: number;
  netTarget1Profit: number;
  netStopLossLoss: number;
  netRewardRiskRatio: number;
  gapRiskNotice: string;
  isCompliantWithHardLimits: boolean;
  hardLimitFailures: string[];
}

export interface EvidenceItem {
  id: string;
  category: 'MACRO' | 'TECHNICAL' | 'POSITIONING' | 'FUNDAMENTALS' | 'EVENT_ANALOG';
  headline: string;
  detail: string;
  source: string;
  timestamp: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  directionalLean: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export type SpecialistAgentRole =
  | 'MACRO_INTELLIGENCE'
  | 'HISTORICAL_RESEARCH'
  | 'GOLD_FUNDAMENTALS'
  | 'TECHNICAL_ANALYSIS'
  | 'QUANTITATIVE_STRATEGY'
  | 'MARKET_STRUCTURE'
  | 'NEWS_EVENT_RISK'
  | 'CFD_RISK'
  | 'PORTFOLIO_EXPOSURE'
  | 'INDEPENDENT_CHALLENGE'
  | 'ADVISORY_COUNCIL';

export interface AgentAssessment {
  role: SpecialistAgentRole;
  agentName: string;
  horizon: AdvisoryHorizon;
  directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  convictionScorePct: number;
  assessment: string;
  keyThesis: string;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  invalidationTrigger: string;
  warningNotice?: string;
  timestamp: string;
}

export interface QuantitativeStrategy {
  id: string;
  name: string;
  category: string;
  applicableHorizons: AdvisoryHorizon[];
  description: string;
  rules: {
    entry: string;
    exit: string;
    stop: string;
    target: string;
    invalidation: string;
  };
  parameters: Record<string, number | string>;
  performance: {
    totalTrades: number;
    winRatePct: number;
    profitFactor: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdownPct: number;
    averageWinnerPct: number;
    averageLoserPct: number;
    expectancyR: number;
  };
  currentSignal: {
    action: TradeDirection;
    active: boolean;
    reason: string;
    signalTime: string;
  };
}

export interface BacktestRunResult {
  strategyId: string;
  strategyName: string;
  timeframe: Timeframe;
  dateRange: { start: string; end: string };
  initialCapital: number;
  endingCapital: number;
  netProfit: number;
  netProfitPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPct: number;
  maxDrawdownDurationDays: number;
  averageTradeBars: number;
  totalCommissionsAndSpread: number;
  equityCurve: { time: string; equity: number; drawdownPct: number }[];
  trades: {
    id: string;
    entryTime: string;
    exitTime: string;
    direction: TradeDirection;
    entryPrice: number;
    exitPrice: number;
    lots: number;
    pnl: number;
    pnlPct: number;
    exitReason: 'TARGET' | 'STOP' | 'TIME_EXPIRY' | 'SIGNAL_REVERSAL';
  }[];
}

export type BacktestTrade = BacktestRunResult['trades'][number];

export interface PaperPosition {
  id: string;
  tradePlanId: string;
  instrumentId: InstrumentId;
  direction: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openTime: string;
  status: 'OPEN' | 'CLOSED_PROFIT' | 'CLOSED_LOSS' | 'CANCELLED';
  notes: string;
}

export interface AlertRule {
  id: string;
  name: string;
  conditionType: 'PRICE_LEVEL' | 'RSI_THRESHOLD' | 'SPREAD_SPIKE' | 'EVENT_COUNTDOWN';
  targetValue: number;
  comparison: 'ABOVE' | 'BELOW' | 'EQUALS';
  horizon: AdvisoryHorizon;
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
}

export interface AlertNotification {
  id: string;
  ruleId: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: string;
  read: boolean;
}

export interface CanonicalInstrument {
  id: InstrumentId;
  commodity: CommodityType;
  family: CommodityFamily;
  symbol: string;
  providerSymbol: string;
  displayName: string;
  benchmark: string;
  assetClass: AssetClass;
  unit: string;
  quoteCurrency: string;
  baseCurrency: string;
  tickSize: number;
  tickValue: number;
  contractSize: number;
  lotIncrement: number;
  typicalSpread: number;
  sessionDescription: string;
  timezone: string;
  exchange: string;
  rollMethod?: 'CALENDAR_SPREAD' | 'EXPIRY_SWITCH' | 'NONE';
  isContinuous: boolean;
}

export type HistoricalRangePeriod =
  | '1D'
  | '5D'
  | '1M'
  | '3M'
  | '6M'
  | '1Y'
  | '2Y'
  | '5Y'
  | '10Y'
  | 'MAX'
  | 'CUSTOM';

export interface HistoricalCoverageReport {
  requestedPeriod: HistoricalRangePeriod;
  requestedStartDate: string;
  requestedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  granularity: Timeframe;
  totalBars: number;
  warmUpBars: number;
  visibleBars: number;
  coveragePct: number;
  gapsDetected: number;
  isComplete: boolean;
  dataSource: string;
  lastUpdated: string;
}

export type EventCategory =
  | 'CENTRAL_BANK_POLICY'
  | 'INFLATION_JOBS'
  | 'YIELDS_USD'
  | 'GEOPOLITICAL_SECURITY'
  | 'OPEC_PRODUCTION'
  | 'INVENTORIES_STORAGE'
  | 'INDUSTRIAL_DEMAND'
  | 'PHYSICAL_MINE_SUPPLY'
  | 'FUTURES_POSITIONING'
  | 'ENERGY_TRANSITION'
  | 'TRADE_SANCTIONS';

export type SourceTier = 'TIER_1_PRIMARY' | 'TIER_2_FINANCIAL_MEDIA' | 'TIER_3_INDUSTRY_ANALYST';
export type CausalDirection = 'BULLISH' | 'BEARISH' | 'MIXED_CONDITIONAL' | 'NEUTRAL';
export type EvidenceHorizon = 'INTRADAY' | 'SWING' | 'STRUCTURAL';

export interface NewsEvidenceItem {
  id: string;
  commodity: CommodityType | 'ALL';
  title: string;
  publisher: string;
  sourceTier: SourceTier;
  url: string;
  publicationTime: string;
  eventTime: string;
  ingestionTime: string;
  category: EventCategory;
  summary: string;
  extractedFacts: string[];
  causalTransmission: string;
  reversalConditions: string;
  directionalLean: CausalDirection;
  horizon: EvidenceHorizon;
  materialityScore: number;
  novelty: 'BREAKING' | 'DEVELOPING' | 'PRICED_IN';
  confirmationStatus: 'VERIFIED' | 'UNCONFIRMED_RUMOR' | 'OFFICIAL_RELEASE';
  usedInAdvisoryId?: string;
}

export type ScenarioType = 'BULL' | 'BASE' | 'BEAR' | 'TAIL_RISK';

export interface CommodityScenario {
  type: ScenarioType;
  title: string;
  commodity: CommodityType;
  likelihood: 'HIGH' | 'MODERATE' | 'LOW' | 'TAIL_RISK';
  horizon: string;
  priceTargetProjection: string;
  coreAssumptions: string[];
  supportingCatalysts: string[];
  counterArguments: string[];
  marketStructureConfirmation: string;
  invalidationLevel: string;
  primaryRisks: string[];
}

export type LLMProviderId = 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'LOCAL';

export interface LLMProviderConfig {
  provider: LLMProviderId;
  modelName: string;
  hasKeyConfigured: boolean;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  isGeminiDefault: boolean;
  activeAgentsCount: number;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'DEGRADED';
  lastTested?: string;
}

export interface PublicationGateReport {
  passed: boolean;
  validatedAt: string;
  checks: {
    priceFreshness: { passed: boolean; message: string };
    indicatorWarmUp: { passed: boolean; message: string };
    benchmarkDisambiguation: { passed: boolean; message: string };
    riskAndInvalidationBound: { passed: boolean; message: string };
    evidenceProvenanceAttached: { passed: boolean; message: string };
    schemaIntegrity: { passed: boolean; message: string };
    executionBoundaryCompliance: { passed: boolean; message: string };
    certaintyLanguageCompliance: { passed: boolean; message: string };
  };
  failureReasons: string[];
}
