# 暗黑之雲機制模擬器（測試版）

> 目前為測試版：機制與數值仍在調整，可能和實戰有出入，歡迎回報。

FF14「滅・暗黑之雲激鬥戰」的機制練習器：P1 開場、P2 魔法陣階段兩條時間軸與單一機制，以及 P3（製作中）。
在網頁上用鍵盤滑鼠操作角色，有 23 名照攻略跑位的隊友，可看示範、慢動作回放失誤。

**直接玩：** https://seiran-ilai.github.io/ff14-cloud-of-darkness-sim/

Vite + TypeScript（strict）+ Canvas 2D，沒有 UI 框架。

## 資料來源與攻略來源

本模擬器的機制與打法整理自以下來源，感謝原作者：

| 用途 | 來源 |
|---|---|
| 本攻略原文（イディル改） | [イディルシャイア居住區](https://kanatan.info/archives/38822195.html) |
| 中文翻譯 | [cycleapple FF14 繁中高難攻略 — 滅・暗黑之雲激鬥戰](https://cycleapple.github.io/xiv-tc-battle-guide/chaotic/cloud-of-darkness/) |
| 站位小抄 | [cycleapple 小抄工具](https://cycleapple.github.io/xiv-tc-battle-guide/chaotic/cloud-of-darkness-cheatsheet/) |
| 各機制說明（機制效果、減益秒數、時間軸） | [FF14 灰機 wiki](https://ff14.huijiwiki.com/)（簡體中文，已轉繁體整理） |

- 整理後的機制文件：[`docs/cod-mechanics.md`](docs/cod-mechanics.md)（P1、P2、P4）、[`docs/p2-strategy.md`](docs/p2-strategy.md)（P3 華容道）。打法以標「【攻略處理】」的內容為準。
- **各技能詠唱秒數、AOE 大小、場地尺寸大多是估計值**（攻略與 wiki 都沒寫明），集中在 [`src/core/tuning.ts`](src/core/tuning.ts) 並標「估計」，主要用來練習順序、面向與反應。發現與實戰不符歡迎開 issue。
- FINAL FANTASY XIV 及相關名稱為 SQUARE ENIX 的商標。本專案為玩家自製的非官方練習工具，與 SQUARE ENIX 無關。
- 模擬器製作：[@ilainosu.ffxiv](https://www.threads.net/@ilainosu.ffxiv)（Threads）

## 指令

重構前的單檔版本在 `legacy/cod-sim.html`（測試的對照基準）。

```
npm install
npm run dev      # 開發伺服器
npm test         # Vitest：幾何、示範模式自動跑、legacy 對照、新功能、UI 冒煙測試
npm run build    # 型別檢查 + 打包到 dist/
```

## 結構

```
src/
  main.ts            進入點：組裝模組、固定步長迴圈（模擬 1/120 秒，渲染插值）
  debug.ts           dev 模式才載入：window.__sim，以及截圖用網址參數（見下）
  core/              常數、幾何、判定圈碰撞（hit.ts）、可設定種子的亂數、localStorage、設定、
                     tuning.ts（所有估計值集中處，依實戰校正只改這裡）、攻略站位（positions.ts）
  game/              狀態型別、事件排程、判定結果、模擬一步、技能、Bot、Session（開局／種子／起點／錄影）、
                     回放錄影（replay.ts）、紀錄與失誤統計（stats.ts）
  mechanics/         每個機制一檔：(G, t0, 參數) => 結束時間；檔頭註解寫時間點、判定規則、估計值
  drills/            時間軸 1／2、單一機制（可串成「弱點練習」）
  render/            Canvas 繪製（只讀狀態）：鏡頭、場地、王與手勢、預兆、特效、角色
  ui/                DOM：HUD、技能列、說明、覆蓋層（結算／回放）、設定、音效
  input/             鍵盤、滑鼠
tests/
```

## 截圖／除錯網址參數（只在 `npm run dev`）

`/?drill=tl1&seed=7&t=40&auto=1&cam=follow` 會用示範模式直接快轉到 40 秒並停住。
`drill` 可用 `tl1`、`tl2`、`embrace`、`volley`、`death`、`aero`、`blade`、`flareholy`、`petrify`、`beam`，以及 P3 華容道的 `p2open`、`p2grid`（程式裡沿用 p2 命名），P1 開場是 `opener`。

## 練習模式

- **連續**：從選的階段一路打到最後（P1 開場 → P2 第一次魔法陣 → P3 華容道 → P4 第二次魔法陣，P4 用 P2 沒用到的時間軸，最後是暗之大泛濫強制團滅）。
- **單一階段**：只打 P1～P4 其中一段。
- **隨機**：從勾選的機制（全選 → 階段 → 單一機制）隨機出題，可選重複／不重複、1～5 分鐘；不同場地的機制會瞬間切換場地。
- **機制教學頁**（`guide.html`，模擬器右上「機制教學」）：一整頁往下捲、左側索引（手機是下拉選單）快速跳到指定機制；各階段流程、每個機制的效果／預兆／應對全部展開，動態圖（捲到哪段播哪段）直接播放模擬器的教學示範（照攻略站位的 Bot），可選座位看自己的站位與走位、調速度、換一局。程式在 `src/guide.ts`。
- **開始方式**：錯誤即停／錯誤不停／教學示範。
- **手機版**：版面窄到一欄（≤ 720px）自動切換，只能看教學示範（選站位 → 選階段或單一機制 → 看示範），畫面下方有「機制提示」卡（目前詠唱的處理方式、提示、王台詞與這局的提示紀錄）。程式在 `src/ui/mobile.ts`。
- **機制提示卡**：電腦版在右欄最上面（固定高度，內容在卡片裡捲動）。遊戲畫面寬度小於 760px（較小的電腦螢幕）時，詠唱提示與王台詞不疊在畫面上（避免擋住王的手勢與跑位），只顯示在這張卡。

網址參數 `drill` 也可以用 `run:cont:p1`、`run:one:p3`、`rand:r:3:p3fear,p3spin` 這種格式。

## P3 華容道

攻略整理在 `docs/p2-strategy.md`。場地與機制尺寸大多是從攻略示意圖推估的，集中在 `src/core/tuning.ts` 的 `P2`、`DOMAIN`、`TRIPLE`、`WAVEBALL`。
場地幾何與攻略站位在 `src/core/p2.ts`，格子規則在 `src/game/p2state.ts`，內場 Bot 的格子導航與刷新在 `src/game/p2nav.ts`，機制在 `src/mechanics/p2/`。
