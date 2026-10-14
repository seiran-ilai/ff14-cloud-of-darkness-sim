// 有多種樣式的機制：教學頁可以指定樣式播放（state.ts 的 variant），並顯示該樣式的預兆與應對。
// key 是 G.pick 的名稱；value 是傳給機制的樣式。文字依 docs/cod-mechanics.md、docs/p2-strategy.md 的攻略處理。
import { EMBRACE_TEXT } from '../game/state';

export interface VariantOpt { value: string; label: string; tell: string; how: string }
export interface VariantGroup { key: string; label: string; opts: VariantOpt[] }

const EMB = (t: 'cover' | 'scoop', label: string, how: string): VariantOpt =>
  ({ value: t, label, tell: `${EMBRACE_TEXT[t].icon} ${EMBRACE_TEXT[t].hand}・${EMBRACE_TEXT[t].other}`, how });

/** 練習項目 key → 可以選的樣式（可以有好幾組，例如迴旋式的旋轉方向＋跳躍波動炮的順序） */
export const VARIANTS: Record<string, VariantGroup[]> = {
  embrace: [{
    key: 'embrace', label: '手勢', opts: [
      EMB('cover', '包覆', '手從你<b>面前</b>打：減益結束時<b>面向場內直走</b>。'),
      EMB('scoop', '撈起', '手從你<b>背後</b>打：結束那一刻<b>面向場外</b>，手出現後再轉身往場內（太早轉身手會出在移動方向）。'),
    ],
  }],
  blade: [
    {
      key: 'blade', label: '第一次暗之刃', opts: [
        { value: 'L', label: '左手舉刀', tell: '王的<b>左手</b>舉刀', how: '到沒握刀的那側：<b>東邊</b>的王前方安全區。' },
        { value: 'R', label: '右手舉刀', tell: '王的<b>右手</b>舉刀', how: '到沒握刀的那側：<b>西邊</b>的王前方安全區。' },
        { value: 'B', label: '雙手', tell: '王<b>雙手</b>構刀於身前', how: '離開王身邊（王周圍的大圓形）。' },
      ],
    },
    {
      key: 'stored', label: '超賦', opts: [
        { value: 'aero', label: '超賦風', tell: '台詞「狂風，匯於我的雙腕之中！」；王身上顯示「雲之魔刃：風」', how: '下一次暗之刃（一定單手）炸完立刻接<b>飆風</b>：站藍圈外正東或正西，或開防擊退。' },
        { value: 'death', label: '超賦死', tell: '台詞「死亡，匯於我的雙腕之中！」；王身上顯示「雲之魔刃：死」', how: '下一次暗之刃（一定單手）炸完立刻接<b>極死</b>：開防擊退留在中央圓外，中央圓炸完立刻進中央。' },
      ],
    },
  ],
  petrify: [
    {
      key: 'petrifyHow', label: '處理方式', opts: [
        { value: 'stay', label: '原地背對', tell: '看側邊的邪眼在東還是西', how: '留在原地，判定時<b>面向沒有邪眼的東或西</b>（背對王、正面邪眼和側邊邪眼）。在場地中央要同時背對三個方向，視角比較難調。' },
        { value: 'corner', label: '角落面壁（更安全）', tell: '超石化開始詠唱就可以跑，不用等邪眼位置', how: '跑到<b>王最左側或最右側的角落</b>（王的翅膀邊緣是盲區），<b>面向場外</b>（看著場地外牆）；讀條快結束前保持不動，判定結束再回頭。不管側邊邪眼在哪邊都安全。' },
      ],
    },
    {
      key: 'petrify', label: '側邊邪眼', opts: [
        { value: 'west', label: '邪眼在西', tell: '正面 1 個＋場外<b>西側</b> 2 個邪眼', how: '原地背對：判定時<b>面向東</b>。' },
        { value: 'east', label: '邪眼在東', tell: '正面 1 個＋場外<b>東側</b> 2 個邪眼', how: '原地背對：判定時<b>面向西</b>。' },
      ],
    },
  ],
  p3tower: [{
    key: 'triple', label: '第二／三擊', opts: [
      { value: 'B', label: '含雙手球', tell: '兩隻觸手同時發光（攻略：雙手有球）', how: '雙手那一擊：<b>MT＋H2、D1＋D3、D2＋D4</b> 分攤；另一擊是單手，躲到沒球那半邊。' },
      { value: 'C', label: '含黑霧', tell: '身體中心發光（攻略：身上出黑霧）', how: '黑霧那一擊：照<b>相對方向散開</b>（只在前側散，不要丟到小王背後）；另一擊是單手，躲到沒球那半邊。' },
    ],
  }],
  p3fear: [{
    key: 'fear', label: '形狀', opts: [
      { value: 'ring', label: '環形', tell: '王身邊出現紫色<b>環形暗雲</b>', how: '內場站<b>靠王的格子</b>（各條中段）；外場留在<b>平臺外側</b>。' },
      { value: 'cross', label: '十字', tell: '王身邊出現<b>方形暗雲</b>、紫電往外擴散成十字', how: '外場沿環狀地板到<b>斜角</b>；內場<b>離開中央十字線</b>上的格子。' },
    ],
  }],
  p3charge: [{
    key: 'charge', label: '種類', opts: [
      { value: 'charge', label: '凝聚式', tell: '王周身<b>橙黃色蓄能</b>；台詞「把你們送入更加幽邃的黑暗之中！」', how: '直線分攤：外場整組<b>集合在平臺中央</b>；內場角落 3 人站 <b>L 形</b>（角落格＋坦克往中間 1 格＋凸出格）。' },
      { value: 'spread', label: '分散式', tell: '王周身<b>紫黑色懸浮球</b>；台詞「全都給我消失吧！」', how: '先內場、再外場各一個圓形：內場站<b>待機格中央</b>；外場<b>散開</b>到平臺四角與環狀地板。' },
    ],
  }],
  p3spin: [
    {
      key: 'spinDir', label: '迴旋式', opts: [
        { value: 'cw', label: '順時針', tell: '王周圍一整圈的<b style="color:#ff9b3d">橘色</b>環形箭頭，往<b>順時針</b>轉', how: '內場跟著直線一格一格往<b>剛掃過</b>的格子補（直線往順時針轉，往它後面補）。' },
        { value: 'ccw', label: '逆時針', tell: '王周圍一整圈的<b style="color:#5cc8ff">藍色</b>環形箭頭，往<b>逆時針</b>轉', how: '內場跟著直線一格一格往<b>剛掃過</b>的格子補（直線往逆時針轉，往它後面補）。' },
      ],
    },
    {
      key: 'jump', label: '跳躍波動炮', opts: [
        { value: 'frontFirst', label: '正側', tell: '<b>正側</b>跳躍波動炮：先打正面、再打兩側', how: '外場先站<b>兩側</b>，第一發後進<b>正面</b>。' },
        { value: 'sideFirst', label: '側正', tell: '<b>側正</b>跳躍波動炮：先打兩側、再打正面', how: '外場先站<b>正面</b>，第一發後到<b>兩側</b>。' },
      ],
    },
  ],
  p3swap: [{
    key: 'swap', label: '換位', opts: [
      { value: 'north', label: '換北端', tell: '外場 MT、H2、D1 和內場<b>北端</b>角落互換', how: 'A 隊 MT、H2、D1 進<b>東北角</b>、C 隊的進<b>西北角</b>（MT 站角落格往中間 2 格、H2 角落格北邊、D1 角落格南邊）；西北角的人到<b>東平臺</b>、東北角的人到<b>西平臺</b>；南端兩個角落互換；D2、D3、D4 東西互換。換位後坦克挑釁。' },
      { value: 'south', label: '換南端', tell: '外場 MT、H2、D1 和內場<b>南端</b>角落互換', how: 'A 隊 MT、H2、D1 進<b>東南角</b>、C 隊的進<b>西南角</b>（MT 站角落格往中間 2 格、H2 角落格北邊、D1 角落格南邊）；西南角的人到<b>東平臺</b>、東南角的人到<b>西平臺</b>；北端兩個角落互換；D2、D3、D4 東西互換。換位後坦克挑釁。' },
    ],
  }],
};
