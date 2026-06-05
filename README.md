# 今彩539 智慧分析推薦系統

根據近45期歷史開獎資料，透過多維度統計分析推薦號碼，並計算碰數、成本與獲利。

## 功能

- 爬蟲自動抓取近45期開獎紀錄（每30分鐘更新）
- 使用者自選號碼數量（2~20碼）
- 10種統計分析：號碼頻率、冷熱號、遺漏值、奇偶比、大小比、尾數、區間分佈、和值走勢、連號分析、AC值
- 智慧推薦號碼
- 二星/三星/四星碰數、成本、獲利試算

## 本機執行

```bash
npm install
npm start
```

開啟 http://localhost:3000

## 部署

本專案已內建 `render.yaml`，連結 [Render](https://render.com) 即可一鍵部署。

- Build Command: `npm install`
- Start Command: `npm start`
