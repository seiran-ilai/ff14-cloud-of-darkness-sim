// 估計值集中處。docs/cod-mechanics.md 第 5 節列的「需實戰校正」數值都在這裡。
// 標「docs」的是文件明寫的數值，其餘都是估計（依實戰校正時只改這個檔）。
// 時間欄位都是「相對機制起點 t0」的秒數。

/** 跑速 m/s（估計） */
export const RUN = 6;
/** 疾跑倍率（估計 +30%） */
export const SPRINT_MUL = 1.3;
/** 加重倍率（估計 −50%） */
export const HEAVY_MUL = 0.5;
/** 角色判定圈半徑 m（估計）。所有 AOE 判定都用「判定圈碰到預兆邊緣即中」，安全區則要求判定圈整個在內 */
export const HIT = 0.5;

/** 模擬固定時間步長（秒） */
export const SIM_DT = 1 / 120;
/** 鏡頭：固定視角時畫面中心到邊的距離、跟隨時的距離（m） */
export const VIEW_FIXED = 35;
export const VIEW_FOLLOW = 21;
/** 預兆判定前閃爍的秒數 */
export const TELE_FLASH = 0.3;
/** 回放：判定前後各錄幾秒、錄影頻率、播放倍速 */
export const REPLAY = { before: 4, after: 1, hz: 30, speed: 0.35 } as const;

export const EMBRACE = {
  /** 陰冷擁抱詠唱秒數（估計）；詠唱結束才上減益 */
  cast: 3,
  /** 攥魂之手矩形長度 = 一格（docs） */
  handLen: 11,
  /** 矩形寬度（估計，docs【未知】） */
  handW: 4,
  /** 矩形起點在玩家身後的距離（估計） */
  handBack: 1.5,
  /** 手生成後多久判定（估計） */
  handDelay: 1.25,
  /** 剩幾秒時附加加重（docs） */
  heavyAt: 1,
  /** 加重持續（docs） */
  heavyDur: 2,
  /** 剩幾秒時出現提示（docs） */
  warnAt: 5,
  /** 王擺出手勢的提前秒數（估計） */
  poseLead: 6,
  /** 離場邊幾公尺內算「外周」（估計） */
  edgeOk: 8,
} as const;

export const VOLLEY = {
  /** 四輪：雲發光時間（估計） */
  glow: [0, 1.5, 4, 5.5],
  /** 四輪：發射時間（估計） */
  fire: [4, 5.5, 7.5, 9],
  /** 地面預兆提前秒數（估計） */
  teleLead: 1.2,
  /** 雲距離場邊（估計，示意） */
  cloudOut: 3.2,
} as const;

export const FLARE = {
  cast: 5.5,
  /** 丟到指定端點的容許距離（估計） */
  spotTol: 6,
  /** 沒被點的人至少要離目標多遠（估計） */
  safeDist: 8,
} as const;

export const HOLY = {
  cast: 4,
  /** 分攤圈半徑（估計） */
  stackR: 3.2,
} as const;

export const BLADE = {
  cast: 4.5,
  /** 單手安全區：王前方、沒舉手那側的圓（估計） */
  pocketX: 11,
  pocketY: -10.5,
  pocketR: 6.5,
  /** 雙手：王周圍大圓半徑（估計） */
  bothR: 17,
} as const;

export const ENHANCE = { cast: 2.5 } as const;

export const PETRIFY = {
  cast: 4.5,
  /** 面向王或邪眼幾度內會石化（估計 ±60°） */
  gazeAngle: Math.PI / 3,
  /** 石化秒數（docs） */
  stoneDur: 9,
  /** 邪眼在場外多遠、南北間距（估計） */
  eyeOut: 2.5,
  eyeY: 4.5,
} as const;

export const AERO = {
  /** 藍圈半徑（估計） */
  blueR: 6,
  /** 擊退距離與時間（估計） */
  kbDist: 16,
  kbTime: 0.6,
  /** 超賦後無讀條：暗之刃判定後幾秒（估計） */
  storedDelay: 2,
} as const;

export const DEATH = {
  /** 吸引距離與時間（估計） */
  pullDist: 16,
  pullTime: 0.7,
  /** 中央圓半徑（估計） */
  circleR: 10,
  /** 吸引後多久出中央圓預兆 / 判定（估計） */
  circleTele: 0.85,
  circleAt: 1.85,
  /** 環形判定（= 圓炸後 2.6 秒，估計） */
  donutAt: 4.45,
  storedDelay: 2,
} as const;

export const BEAM = {
  cast: 4,
  /** 線寬（估計） */
  width: 5,
  /** 4 輪間隔（估計） */
  interval: 1.2,
} as const;

export const DELUGE = { cast: 4 } as const;

// ===================== P2 華容道 =====================
// 場地形狀依攻略示意圖判讀（docs/p2-strategy.md），尺寸全部是估計。

export const P2 = {
  /** 內場格子邊長 m（估計） */
  cell: 4,
  /** 8×8 方格，只有第 1、6 列與第 1、6 行有地板（攻略圖） */
  n: 8,
  bars: [1, 6] as readonly number[],
  /** 平臺：|x| ∈ [px0, px1]、|y| ≤ ph（估計） */
  px0: 19,
  px1: 28,
  ph: 5,
  /** 環狀地板半徑範圍（估計） */
  ring0: 23,
  ring1: 27,
  /** 小王在平臺中央，面向場外（攻略：拉王面向場外） */
  sbX: 23.5,
  /** 格子：單人站 40 秒變紅、45 秒消失；2 人以上 1 秒後消失；消失 1 秒後重生（docs） */
  standRed: 40,
  standGone: 45,
  crowdGone: 1,
  regen: 1,
} as const;

export const DOMAIN = {
  cast: 4,
  /** 深暗領域後環狀地板變成出血區域的秒數（估計；docs 寫「持續一段時間的出血區域」，攻略寫「即死地板」） */
  bleed: 20,
} as const;

export const TRIPLE = {
  /** 三重暗之戰技：詠唱秒數、三次判定的間隔、每次判定前多久亮出特效（估計） */
  cast: 5,
  gap: 3,
  tell: 3,
  /** 單手球：小王左／右半場的半圓半徑（估計，讓井字縱向格的「本體側」剛好安全） */
  halfR: 15,
  /** 雙手球：最近 3 人的 2 人分攤圓半徑（估計） */
  pairR: 2.2,
  /** 黑霧：最近 6 人的直線寬度的一半、長度（估計） */
  lineHalfW: 1,
  lineLen: 40,
} as const;

export const WAVEBALL = {
  /** 波動球詠唱秒數；塔出現後幾秒判定（估計） */
  cast: 10,
  soak: 6,
  /** 外場三人塔：半徑、離小王的距離（估計） */
  outerR: 2.5,
  outerD: 3.5,
} as const;
