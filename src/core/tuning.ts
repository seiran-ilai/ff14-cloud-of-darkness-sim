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

/** Bot 看到預兆後多久開始動（反應時間，估計） */
export const REACT = 0.6;
/** 攻擊範圍（地面預兆）出現到實際判定的緩衝（估計） */
export const TELE_SHOW = 2;
/** 模擬固定時間步長（秒） */
export const SIM_DT = 1 / 120;
/** 鏡頭：固定視角時畫面中心到邊的距離、跟隨時的距離（m） */
export const VIEW_FIXED = 40;
/** 固定鏡頭的中心往北移：場地北緣（王、P1 單手安全區）不要被上方的詠唱條擋住 */
export const VIEW_FIXED_CY = -7;
export const VIEW_FOLLOW = 21;
/** 跟隨鏡頭的距離（畫面中心到邊幾公尺）：近＝原本的放大、中、遠＝看得到場外邪眼、破片雲 */
export const VIEW_ZOOM = { near: VIEW_FOLLOW, mid: 28, far: 36 } as const;
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
  /** 沒被點的人離北邊集合點的容許距離（估計） */
  stackTol: 6,
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
  /** 環形判定（= 圓炸後 1.6 秒，估計；測試回饋：實戰中央圓一炸就要立刻進去） */
  donutAt: 3.45,
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

/** 暗之大泛濫：詠唱秒數（估計）；出血 15 秒（docs） */
export const GREAT_DELUGE = { cast: 6, bleed: 15 } as const;

/** 開場準備階段：3 次暗之刃的起點（估計） */
/**
 * P1 開場（準備階段）：場地是大圓形，地面有一個直角 V 字圖案（頂點在中心偏南 R/4，兩邊 45° 往下到場邊）。
 * 尺寸依使用者提供的示意圖換算（R＝場地半徑），都是估計。
 */
export const OPENER = {
  blades: [3, 12, 21],
  deluge: 30,
  /** 圓形場地半徑：和 P2 菱形的東、西、南角同一個圓 */
  roundR: 31,
  /** 單手暗之刃安全區：場地北緣、王的左右兩側各一個圓（示意圖 ±0.29R、−0.92R，半徑 0.24R） */
  pocketX: 9,
  pocketY: -28.5,
  pocketR: 7.4,
  /** 雙手暗之刃：北半場的橢圓（示意圖中心 −0.53R、橫半軸 0.98R、縱半軸 0.71R）；站到地面 V 字頂點就安全 */
  bothCY: -16.4,
  bothRX: 30.4,
  bothRY: 22,
} as const;

/** 地面直角 V 字圖案的頂點 y（中心偏南 R/4） */
export const FLOOR_V_Y = 7.75;

/** P2 魔法陣：菱形把北角切平，y 小於這條線（王底下）沒有地板（示意圖 −R/2） */
export const GEM_CUT = -15.5;

// ===================== P2 =====================
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
  /** 三重暗之戰技：詠唱秒數、三次判定的間隔、Bot 每擊前多久開始移動；詠唱中依序亮球的間隔與每個球亮幾秒（估計） */
  cast: 5,
  gap: 3,
  tell: 3,
  show: 1.4,
  showFor: 1.1,
  /** 單手球：小王左／右半場的半圓半徑（估計：蓋住整個平臺，碰到內場最外側格子的邊緣，站格子中央是安全的） */
  halfR: 12.5,
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

// ===================== P3 華容道：其餘機制（尺寸、秒數全部是估計） =====================

export const P3 = {
  /** 內場 Bot 換格：每一步的間隔（一次走一格） */
  stepDt: 0.7,
  /** 恐懼之雲：詠唱、環形內外半徑、十字半寬、恐怖秒數（docs 6 秒） */
  fear: { cast: 5, r0: 12.5, r1: 21, crossHW: 4, stun: 6 },
  /** 波動詛咒：詠唱；詛咒式波動炮扇形半徑、半張角 */
  curse: { cast: 4, r: 20, w: (15 * Math.PI) / 180 },
  /** 種子彈：詠唱、點名到落地、圓形半徑、荊棘範圍、兩個荊棘太近會大爆炸的距離、荊棘佔格的寬限秒數 */
  seed: { cast: 4, mark: 5, r: 3, thornR: 1.5, boom: 3, grace: 1 },
  /** 荊棘叢生：詠唱、連線秒數（docs 18 秒）、剩 5 秒時要拉開的距離（外場荊棘、內場兩人） */
  thorn: { cast: 4, dur: 18, warnLeft: 5, pull: 14, pair: 26 },
  /** 小王暗之泛濫（可打斷） */
  sbDeluge: { cast: 6 },
  /** 凝聚式：詠唱、直線半寬、外場／內場需要的人數；分散式：圓形半徑、外場晚幾秒 */
  charge: { cast: 5, hw: 2.5, needOut: 4, needIn: 2 },
  spread: { cast: 5, r: 3, outerDelay: 2 },
  /** 迴旋式：詠唱、5 擊間隔、每擊轉幾度、直線半寬、長度（只打內場）。測試回饋：實戰讀條約 10～12 秒、範圍比原本大 */
  spin: { cast: 11, gap: 1.4, step: (22.5 * Math.PI) / 180, hw: 2.2, len: 18 },
  /** 跳躍波動炮：小王跳到平臺內側（相對 f）、扇形半徑、半張角、兩發間隔 */
  jump: { f: -4, r: 10.5, w: Math.PI / 4, gap: 1.6 },
  /** 混沌迫近：詠唱、眩暈 */
  swap: { cast: 5, stun: 2 },
  /** 潛地式：詠唱、16 發的間隔、落在幾秒前的位置、圓形半徑 */
  dive: { cast: 7, n: 16, gap: 0.6, lag: 1, r: 2.5 },
  /** 磔殺：詠唱、圓形半徑（坦克死刑） */
  impale: { cast: 4, r: 5 },
  /** 雲散：詠唱 */
  vanish: { cast: 5 },
} as const;
