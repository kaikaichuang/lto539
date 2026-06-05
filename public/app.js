let allDrawData = [];      // 伺服器抓回的完整資料（最多45期）
let drawData = [];         // 目前分析使用的期數切片（30 或 45）
let currentPeriods = 45;   // 目前選擇的載入期數
let activeTab = 'frequency';

const COST_PER_BET = 75;
const STAR_CONFIG = [
  { key: 'star2', name: '二星', pick: 2, prize: 5300 },
  { key: 'star3', name: '三星', pick: 3, prize: 57000 },
  { key: 'star4', name: '四星', pick: 4, prize: 750000 }
];

document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      renderTabContent(activeTab);
    });
  });
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPeriods = parseInt(btn.dataset.periods);
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPeriodSelection();
    });
  });
});

async function fetchData() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('error-msg').style.display = 'none';

  try {
    const res = await fetch('/api/lottery');
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || '取得資料失敗');
    }

    allDrawData = json.data;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';

    applyPeriodSelection();
  } catch (err) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-msg').style.display = 'block';
    document.getElementById('error-msg').textContent = '載入失敗: ' + err.message;
  }
}

// 根據目前選擇的期數（30/45）切片並重新渲染所有分析
function applyPeriodSelection() {
  drawData = allDrawData.slice(0, currentPeriods);

  const range = drawData.length > 0
    ? `已載入 ${drawData.length} 期資料（${formatDate(drawData[drawData.length - 1].date)} ~ ${formatDate(drawData[0].date)}）`
    : '無資料';
  document.getElementById('data-range').textContent = range;

  renderDrawTable();
  renderTabContent(activeTab);

  // 若已產生過推薦，依新期數重新計算
  if (document.getElementById('recommendation').style.display === 'block') {
    generateRecommendation();
  }
}

// 來源日期格式為「MM/DDYY(週)」，例如 06/0426(四) = 2026/06/04 星期四
function formatDate(raw) {
  if (!raw) return '';
  const m = raw.match(/^(\d{2})\/(\d{2})(\d{2})\s*(\(.+\))?/);
  if (!m) return raw;
  const [, mm, dd, yy, week] = m;
  return `20${yy}/${mm}/${dd} ${week || ''}`.trim();
}

function renderDrawTable() {
  const tbody = document.getElementById('draw-body');
  tbody.innerHTML = drawData.map(d => `
    <tr>
      <td>${d.period}</td>
      <td>${formatDate(d.date)}</td>
      <td>${d.numbers.map(n => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join('')}</td>
    </tr>
  `).join('');
}

// ===== Analysis Functions =====

function getFrequency() {
  const freq = {};
  for (let i = 1; i <= 39; i++) freq[i] = 0;
  drawData.forEach(d => d.numbers.forEach(n => freq[n]++));
  return freq;
}

function getMissingValues() {
  const missing = {};
  for (let i = 1; i <= 39; i++) missing[i] = -1;

  for (let i = 0; i < drawData.length; i++) {
    drawData[i].numbers.forEach(n => {
      if (missing[n] === -1) missing[n] = i;
    });
  }

  for (let i = 1; i <= 39; i++) {
    if (missing[i] === -1) missing[i] = drawData.length;
  }
  return missing;
}

function getOddEvenStats() {
  return drawData.map(d => {
    const odd = d.numbers.filter(n => n % 2 === 1).length;
    return { period: d.period, date: d.date, odd, even: 5 - odd, ratio: `${odd}:${5 - odd}` };
  });
}

function getBigSmallStats() {
  return drawData.map(d => {
    const small = d.numbers.filter(n => n <= 19).length;
    return { period: d.period, date: d.date, small, big: 5 - small, ratio: `${small}:${5 - small}` };
  });
}

function getTailStats() {
  const tails = {};
  for (let i = 0; i <= 9; i++) tails[i] = 0;
  drawData.forEach(d => d.numbers.forEach(n => tails[n % 10]++));
  return tails;
}

function getRangeStats() {
  const ranges = { '01-07': 0, '08-14': 0, '15-21': 0, '22-28': 0, '29-35': 0, '36-39': 0 };
  const rangeDef = [[1,7],[8,14],[15,21],[22,28],[29,35],[36,39]];
  const keys = Object.keys(ranges);

  drawData.forEach(d => d.numbers.forEach(n => {
    for (let i = 0; i < rangeDef.length; i++) {
      if (n >= rangeDef[i][0] && n <= rangeDef[i][1]) {
        ranges[keys[i]]++;
        break;
      }
    }
  }));
  return ranges;
}

function getSumStats() {
  return drawData.map(d => ({
    period: d.period,
    date: d.date,
    sum: d.numbers.reduce((a, b) => a + b, 0)
  }));
}

function getConsecutiveStats() {
  let totalWithConsec = 0;
  const pairCount = {};

  drawData.forEach(d => {
    const sorted = [...d.numbers].sort((a, b) => a - b);
    let hasConsec = false;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] === 1) {
        hasConsec = true;
        const key = `${sorted[i]}-${sorted[i + 1]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
    if (hasConsec) totalWithConsec++;
  });

  return { totalWithConsec, rate: totalWithConsec / drawData.length, pairCount };
}

function getACValue(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const diffs = new Set();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      diffs.add(sorted[j] - sorted[i]);
    }
  }
  return diffs.size - (sorted.length - 1);
}

function getACStats() {
  return drawData.map(d => ({
    period: d.period,
    date: d.date,
    ac: getACValue(d.numbers)
  }));
}

// ===== 進階規律分析 =====
// 註：drawData[0] 為最新一期，index 越大越舊

// 間隔規律：每個號碼平均隔幾期出現、目前已幾期未出現、預測下次
function getIntervalStats() {
  const result = [];
  for (let n = 1; n <= 39; n++) {
    // 找出該號碼出現的所有期數索引（由新到舊）
    const idx = [];
    drawData.forEach((d, i) => { if (d.numbers.includes(n)) idx.push(i); });

    if (idx.length === 0) {
      result.push({ num: n, count: 0, avgGap: null, currentMissing: drawData.length, predictedIn: null, overdue: true, gaps: [] });
      continue;
    }

    // 相鄰兩次出現的間隔（期數差）
    const gaps = [];
    for (let i = 0; i < idx.length - 1; i++) {
      gaps.push(idx[i + 1] - idx[i]);
    }
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
    const currentMissing = idx[0]; // 最近一次出現距今幾期（0=最新期就有）
    let predictedIn = null, overdue = false;
    if (avgGap !== null) {
      predictedIn = Math.round(avgGap - currentMissing);
      if (predictedIn <= 0) { overdue = true; predictedIn = 0; }
    }
    result.push({ num: n, count: idx.length, avgGap, currentMissing, predictedIn, overdue, gaps });
  }
  return result;
}

// 號碼關聯：選定號碼 num，統計「同期一起出現」與「下一期接著出現」的伴隨號碼
function getNumberAssociation(num) {
  const sameDraw = {};   // 同期伴隨
  const nextDraw = {};   // 下一期接著出現
  for (let i = 1; i <= 39; i++) { sameDraw[i] = 0; nextDraw[i] = 0; }

  let appearCount = 0;
  let nextChances = 0;

  drawData.forEach((d, i) => {
    if (!d.numbers.includes(num)) return;
    appearCount++;

    // 同期：同一張開獎裡的其他號碼
    d.numbers.forEach(other => { if (other !== num) sameDraw[other]++; });

    // 下一期：index i-1 為時間上「之後」的那一期（更新）
    if (i - 1 >= 0) {
      nextChances++;
      drawData[i - 1].numbers.forEach(other => { nextDraw[other]++; });
    }
  });

  const toSorted = (obj) => Object.entries(obj)
    .map(([n, c]) => ({ num: parseInt(n), count: c }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    appearCount,
    nextChances,
    sameDraw: toSorted(sameDraw),
    nextDraw: toSorted(nextDraw)
  };
}

// 滯後關聯規律：找出「X 出現後第 L 期常開出 Y」的規律，並判斷本期是否正逢觸發時機
// 邏輯：X 上次出現距今 m 期 → 即將開的這期，正是距 X 第 (m+1) 期。
//       若歷史上「X 出現後第 (m+1) 期」常開出 Y，則本期推薦 Y。
function getLaggedPatternSignals() {
  const maxLag = 8;
  const minCount = drawData.length >= 40 ? 3 : 2;

  const appear = {};
  for (let n = 1; n <= 39; n++) appear[n] = [];
  drawData.forEach((d, i) => d.numbers.forEach(n => appear[n].push(i)));

  const signals = [];
  for (let x = 1; x <= 39; x++) {
    const xs = appear[x];
    if (!xs.length) continue;
    const m = xs[0];               // 距上次出現幾期（0 = 最新期就有）
    const targetLag = m + 1;       // 即將開的這期 = 距 X 第幾期
    if (targetLag > maxLag) continue;

    const follow = {};
    let opportunities = 0;
    for (const i of xs) {
      const j = i - targetLag;     // 該次 X 出現後第 targetLag 期（index 越小越新）
      if (j < 0) continue;         // 落在未來、無法觀測
      opportunities++;
      drawData[j].numbers.forEach(y => { follow[y] = (follow[y] || 0) + 1; });
    }
    for (const [y, c] of Object.entries(follow)) {
      if (c >= minCount && parseInt(y) !== x) {
        signals.push({ x, y: parseInt(y), lag: targetLag, count: c, opportunities, xMissing: m });
      }
    }
  }
  signals.sort((a, b) => b.count - a.count);
  return signals;
}

// ===== Tab Rendering =====

function renderTabContent(tab) {
  const container = document.getElementById('tab-content');
  const renderers = {
    frequency: renderFrequency,
    hotcold: renderHotCold,
    missing: renderMissing,
    interval: renderInterval,
    association: renderAssociation,
    oddeven: renderOddEven,
    bigsmall: renderBigSmall,
    tail: renderTail,
    range: renderRange,
    sum: renderSum,
    consecutive: renderConsecutive,
    ac: renderAC
  };
  if (renderers[tab]) renderers[tab](container);
}

function renderFrequency(el) {
  const freq = getFrequency();
  const maxFreq = Math.max(...Object.values(freq));

  let html = '<div class="analysis-summary">各號碼在近' + drawData.length + '期中出現的次數分佈：</div>';
  for (let i = 1; i <= 39; i++) {
    const pct = (freq[i] / maxFreq * 100).toFixed(0);
    const cls = freq[i] >= maxFreq * 0.8 ? 'hot' : freq[i] >= maxFreq * 0.5 ? 'warm' : freq[i] >= maxFreq * 0.3 ? 'cool' : 'cold';
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label">${String(i).padStart(2, '0')}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar ${cls}" style="width:${Math.max(pct, 8)}%">${freq[i]}次</div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

function renderHotCold(el) {
  const freq = getFrequency();
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const hot = sorted.slice(0, 10);
  const cold = sorted.slice(-10).reverse();

  let html = '<div class="analysis-summary">根據近' + drawData.length + '期出現頻率，分析最熱與最冷號碼：</div>';
  html += '<h3 style="color:#ff4b2b;margin-bottom:12px;">熱號 TOP 10（出現頻率最高）</h3>';
  html += '<div class="number-balls">' + hot.map(([n, c]) =>
    `<div style="text-align:center"><span class="ball hot">${n}</span><div style="font-size:0.75em;color:#999;margin-top:4px">${c}次</div></div>`
  ).join('') + '</div>';

  html += '<h3 style="color:#4facfe;margin:20px 0 12px;">冷號 TOP 10（出現頻率最低）</h3>';
  html += '<div class="number-balls">' + cold.map(([n, c]) =>
    `<div style="text-align:center"><span class="ball cold">${n}</span><div style="font-size:0.75em;color:#999;margin-top:4px">${c}次</div></div>`
  ).join('') + '</div>';

  el.innerHTML = html;
}

function renderMissing(el) {
  const missing = getMissingValues();
  const sorted = Object.entries(missing).sort((a, b) => b[1] - a[1]);
  const maxMiss = Math.max(...Object.values(missing));

  let html = '<div class="analysis-summary">遺漏值 = 該號碼距上次開出已間隔的期數，遺漏值越大表示越久未開出：</div>';
  for (const [num, val] of sorted) {
    const pct = maxMiss > 0 ? (val / maxMiss * 100).toFixed(0) : 0;
    const cls = val >= maxMiss * 0.7 ? 'hot' : val >= maxMiss * 0.4 ? 'warm' : 'cool';
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label">${String(num).padStart(2, '0')}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar ${cls}" style="width:${Math.max(pct, 8)}%">${val}期</div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

// 間隔預測：每個號碼平均隔幾期出現、目前已幾期沒出現、預測還要幾期
function renderInterval(el) {
  const stats = getIntervalStats().filter(s => s.count > 0);

  // 即將到期（overdue 或 predictedIn 很小）排前面
  const sorted = [...stats].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (a.predictedIn ?? 99) - (b.predictedIn ?? 99);
  });

  let html = `<div class="analysis-summary">
    <strong>間隔規律分析</strong>：統計每個號碼「平均隔幾期出現一次」，再對照「目前已幾期沒出現」，
    推算<strong>預計還要幾期</strong>會再出現。<br>
    <span style="color:#ff4b2b">紅色=已超過平均間隔（隨時可能開出）</span>，數字越小代表越接近預測出現時機。
  </div>`;

  html += `<div class="table-wrapper"><table class="profit-table">
    <thead><tr>
      <th>號碼</th><th>出現次數</th><th>平均間隔</th><th>已幾期未出</th><th>預計再幾期出現</th>
    </tr></thead><tbody>`;

  for (const s of sorted) {
    const statusCls = s.overdue ? 'negative' : 'positive';
    const predictText = s.overdue
      ? '<span class="negative">已到期 ★</span>'
      : `<span class="${statusCls}">約 ${s.predictedIn} 期後</span>`;
    html += `<tr>
      <td><span class="ball small-ball">${String(s.num).padStart(2, '0')}</span></td>
      <td>${s.count} 次</td>
      <td>${s.avgGap !== null ? s.avgGap.toFixed(1) + ' 期' : '-'}</td>
      <td>${s.currentMissing} 期</td>
      <td>${predictText}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// 號碼關聯：選一個號碼，看它常跟哪些號碼「同期出現」與「下一期接著出現」
function renderAssociation(el) {
  const options = [];
  for (let i = 1; i <= 39; i++) {
    options.push(`<option value="${i}" ${i === associationNum ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`);
  }

  let html = `<div class="analysis-summary">
    <strong>號碼關聯分析</strong>：選一個號碼，分析在近${drawData.length}期中——<br>
    ① <strong>同期伴隨</strong>：它出現時，最常和哪些號碼一起開出<br>
    ② <strong>下期接續</strong>：它出現後的「下一期」，最常接著開出哪些號碼
  </div>`;

  html += `<div class="assoc-picker">
    <label>選擇號碼：</label>
    <select id="assoc-select" onchange="onAssociationChange(this.value)">${options.join('')}</select>
  </div>`;

  html += `<div id="assoc-result"></div>`;
  el.innerHTML = html;
  renderAssociationResult();
}

let associationNum = 2;

function onAssociationChange(val) {
  associationNum = parseInt(val);
  renderAssociationResult();
}

function renderAssociationResult() {
  const container = document.getElementById('assoc-result');
  if (!container) return;

  const a = getNumberAssociation(associationNum);
  const numLabel = String(associationNum).padStart(2, '0');

  if (a.appearCount === 0) {
    container.innerHTML = `<div class="analysis-summary">號碼 ${numLabel} 在近${drawData.length}期中未曾出現。</div>`;
    return;
  }

  const renderList = (list, total, color) => {
    if (!list.length) return '<p style="color:#999">無資料</p>';
    const max = list[0].count;
    return list.slice(0, 12).map(x => {
      const pct = (x.count / max * 100).toFixed(0);
      const rate = total > 0 ? (x.count / total * 100).toFixed(0) : 0;
      return `<div class="freq-bar-container">
        <span class="freq-bar-label">${String(x.num).padStart(2, '0')}</span>
        <div class="freq-bar-wrap">
          <div class="freq-bar ${color}" style="width:${Math.max(pct, 10)}%">${x.count}次 (${rate}%)</div>
        </div>
      </div>`;
    }).join('');
  };

  let html = `<div class="analysis-summary" style="margin-top:16px">
    號碼 <strong>${numLabel}</strong> 在近${drawData.length}期中共出現 <strong>${a.appearCount}</strong> 次
  </div>`;

  html += `<div class="assoc-cols">`;
  html += `<div class="assoc-col">
    <h3>① 同期最常一起出現</h3>
    ${renderList(a.sameDraw, a.appearCount, 'warm')}
  </div>`;
  html += `<div class="assoc-col">
    <h3>② 下一期最常接著出現</h3>
    ${renderList(a.nextDraw, a.nextChances, 'cool')}
  </div>`;
  html += `</div>`;

  container.innerHTML = html;
}

function renderOddEven(el) {
  const stats = getOddEvenStats();
  const ratioCounts = {};
  stats.forEach(s => ratioCounts[s.ratio] = (ratioCounts[s.ratio] || 0) + 1);

  let html = '<div class="analysis-summary">分析每期開獎號碼的奇偶數比例分佈，539共5個號碼：</div>';
  html += '<h3>奇偶比分佈統計</h3>';
  const maxR = Math.max(...Object.values(ratioCounts));
  for (const [ratio, count] of Object.entries(ratioCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / maxR * 100).toFixed(0);
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label" style="width:40px">${ratio}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar warm" style="width:${Math.max(pct, 10)}%">${count}期 (${(count/drawData.length*100).toFixed(1)}%)</div>
      </div>
    </div>`;
  }

  html += '<h3 style="margin-top:20px">近期走勢（最近20期）</h3>';
  html += '<div class="chart-row">';
  stats.slice(0, 20).reverse().forEach(s => {
    html += `<div class="chart-bar-wrap">
      <div class="chart-value">${s.odd}奇</div>
      <div class="chart-bar" style="height:${s.odd / 5 * 100}%;background:linear-gradient(#f7971e,#ffd200);"></div>
      <div class="chart-label">${s.period.slice(-3)}</div>
    </div>`;
  });
  html += '</div>';

  el.innerHTML = html;
}

function renderBigSmall(el) {
  const stats = getBigSmallStats();
  const ratioCounts = {};
  stats.forEach(s => ratioCounts[s.ratio] = (ratioCounts[s.ratio] || 0) + 1);

  let html = '<div class="analysis-summary">大小分析：1~19為小號，20~39為大號，分析每期大小比例：</div>';
  html += '<h3>大小比分佈統計</h3>';
  const maxR = Math.max(...Object.values(ratioCounts));
  for (const [ratio, count] of Object.entries(ratioCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / maxR * 100).toFixed(0);
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label" style="width:40px">${ratio}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar cool" style="width:${Math.max(pct, 10)}%">${count}期 (${(count/drawData.length*100).toFixed(1)}%)</div>
      </div>
    </div>`;
  }

  html += '<h3 style="margin-top:20px">近期走勢（最近20期）</h3>';
  html += '<div class="chart-row">';
  stats.slice(0, 20).reverse().forEach(s => {
    html += `<div class="chart-bar-wrap">
      <div class="chart-value">${s.small}小</div>
      <div class="chart-bar" style="height:${s.small / 5 * 100}%;background:linear-gradient(#4facfe,#00f2fe);"></div>
      <div class="chart-label">${s.period.slice(-3)}</div>
    </div>`;
  });
  html += '</div>';

  el.innerHTML = html;
}

function renderTail(el) {
  const tails = getTailStats();
  const maxT = Math.max(...Object.values(tails));

  let html = '<div class="analysis-summary">尾數分析：統計各尾數（0~9）在近' + drawData.length + '期中出現的頻率：</div>';
  for (let i = 0; i <= 9; i++) {
    const pct = (tails[i] / maxT * 100).toFixed(0);
    const cls = tails[i] >= maxT * 0.8 ? 'hot' : tails[i] >= maxT * 0.5 ? 'warm' : 'cool';
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label">尾${i}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar ${cls}" style="width:${Math.max(pct, 8)}%">${tails[i]}次</div>
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

function renderRange(el) {
  const ranges = getRangeStats();
  const maxR = Math.max(...Object.values(ranges));

  let html = '<div class="analysis-summary">將1~39分為6個區間，分析各區間號碼出現頻率：</div>';
  const colors = ['hot', 'warm', 'warm', 'cool', 'cool', 'cold'];
  let i = 0;
  for (const [range, count] of Object.entries(ranges)) {
    const pct = (count / maxR * 100).toFixed(0);
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label" style="width:48px;font-size:0.8em">${range}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar ${colors[i]}" style="width:${Math.max(pct, 8)}%">${count}次</div>
      </div>
    </div>`;
    i++;
  }
  el.innerHTML = html;
}

function renderSum(el) {
  const sums = getSumStats();
  const values = sums.map(s => s.sum);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const min = Math.min(...values);
  const max = Math.max(...values);

  let html = `<div class="analysis-summary">
    和值 = 每期5個號碼的總和。近${drawData.length}期：平均和值 <strong>${avg}</strong>，
    最小 <strong>${min}</strong>，最大 <strong>${max}</strong>
  </div>`;

  html += '<h3>近30期和值走勢</h3>';
  const recent = sums.slice(0, 30).reverse();
  const chartMax = Math.max(...recent.map(s => s.sum));
  const chartMin = Math.min(...recent.map(s => s.sum));
  const range = chartMax - chartMin || 1;

  html += '<div class="chart-row" style="height:180px;">';
  recent.forEach(s => {
    const h = ((s.sum - chartMin) / range * 80 + 20);
    html += `<div class="chart-bar-wrap">
      <div class="chart-value">${s.sum}</div>
      <div class="chart-bar" style="height:${h}%;background:linear-gradient(#f7971e,#ffd200);"></div>
      <div class="chart-label">${s.period.slice(-3)}</div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function renderConsecutive(el) {
  const stats = getConsecutiveStats();
  const topPairs = Object.entries(stats.pairCount).sort((a, b) => b[1] - a[1]).slice(0, 15);

  let html = `<div class="analysis-summary">
    近${drawData.length}期中，有 <strong>${stats.totalWithConsec}</strong> 期出現連號，
    出現率 <strong>${(stats.rate * 100).toFixed(1)}%</strong>
  </div>`;

  html += '<h3>最常出現的連號組合</h3>';
  html += '<div class="pair-grid">';
  topPairs.forEach(([pair, count]) => {
    html += `<div class="pair-item"><div class="nums">${pair}</div><div class="count">${count}次</div></div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function renderAC(el) {
  const stats = getACStats();
  const acCounts = {};
  stats.forEach(s => acCounts[s.ac] = (acCounts[s.ac] || 0) + 1);

  const values = stats.map(s => s.ac);
  const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

  let html = `<div class="analysis-summary">
    AC值（算術複雜度）衡量號碼組合的離散程度，AC值越高號碼越分散。
    近${drawData.length}期平均AC值：<strong>${avg}</strong>（理論範圍0~7）
  </div>`;

  html += '<h3>AC值分佈</h3>';
  const maxAC = Math.max(...Object.values(acCounts));
  for (const [ac, count] of Object.entries(acCounts).sort((a, b) => a[0] - b[0])) {
    const pct = (count / maxAC * 100).toFixed(0);
    html += `<div class="freq-bar-container">
      <span class="freq-bar-label">AC${ac}</span>
      <div class="freq-bar-wrap">
        <div class="freq-bar warm" style="width:${Math.max(pct, 8)}%">${count}期 (${(count/drawData.length*100).toFixed(1)}%)</div>
      </div>
    </div>`;
  }

  html += '<h3 style="margin-top:20px">近20期AC值走勢</h3>';
  html += '<div class="chart-row">';
  stats.slice(0, 20).reverse().forEach(s => {
    const h = (s.ac / 7 * 80 + 20);
    html += `<div class="chart-bar-wrap">
      <div class="chart-value">${s.ac}</div>
      <div class="chart-bar" style="height:${h}%;background:linear-gradient(#667eea,#764ba2);"></div>
      <div class="chart-label">${s.period.slice(-3)}</div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

// ===== Recommendation Engine =====

function generateRecommendation() {
  const input = document.getElementById('num-count');
  const count = parseInt(input.value);

  if (isNaN(count) || count < 2 || count > 20) {
    alert('請輸入 2 到 20 之間的數字');
    return;
  }

  const selectedStars = STAR_CONFIG.filter(s => {
    const cb = document.getElementById(s.key);
    return cb && cb.checked && count >= s.pick;
  });

  if (selectedStars.length === 0) {
    alert('請至少勾選一個可用的星級（號碼數量需 >= 該星級碼數）');
    return;
  }

  if (drawData.length === 0) {
    alert('尚未載入開獎資料');
    return;
  }

  const signals = getLaggedPatternSignals();
  const scores = calculateScores(signals);
  const recommended = selectNumbers(scores, count);
  const reasons = buildReasons(recommended, scores, signals);

  displayRecommendation(recommended, reasons);
  displayCostCalculation(count, recommended, selectedStars);
}

function calculateScores(signals) {
  const scores = {};
  for (let i = 1; i <= 39; i++) scores[i] = 0;

  const freq = getFrequency();
  const maxFreq = Math.max(...Object.values(freq));

  for (let i = 1; i <= 39; i++) {
    scores[i] += (freq[i] / maxFreq) * 25;
  }

  const missing = getMissingValues();
  const maxMiss = Math.max(...Object.values(missing));
  for (let i = 1; i <= 39; i++) {
    if (missing[i] >= 8) {
      scores[i] += (missing[i] / maxMiss) * 20;
    }
  }

  const recentFreq = {};
  for (let i = 1; i <= 39; i++) recentFreq[i] = 0;
  const recentN = Math.min(15, drawData.length);
  for (let i = 0; i < recentN; i++) {
    drawData[i].numbers.forEach(n => recentFreq[n]++);
  }
  const maxRecent = Math.max(...Object.values(recentFreq));
  for (let i = 1; i <= 39; i++) {
    scores[i] += (recentFreq[i] / (maxRecent || 1)) * 20;
  }

  const tails = getTailStats();
  const avgTail = Object.values(tails).reduce((a, b) => a + b, 0) / 10;
  for (let i = 1; i <= 39; i++) {
    const tail = i % 10;
    if (tails[tail] > avgTail) {
      scores[i] += 5;
    }
  }

  const consec = getConsecutiveStats();
  for (const [pair, count] of Object.entries(consec.pairCount)) {
    if (count >= 3) {
      const [a, b] = pair.split('-').map(Number);
      scores[a] += 3;
      scores[b] += 3;
    }
  }

  const lastDraw = drawData[0].numbers;
  const secondLast = drawData.length > 1 ? drawData[1].numbers : [];
  for (let i = 1; i <= 39; i++) {
    if (lastDraw.includes(i) && secondLast.includes(i)) {
      scores[i] -= 5;
    }
  }

  const ranges = getRangeStats();
  const avgRange = Object.values(ranges).reduce((a, b) => a + b, 0) / 6;
  const rangeDef = [[1,7],[8,14],[15,21],[22,28],[29,35],[36,39]];
  const rangeKeys = Object.keys(ranges);
  for (let i = 1; i <= 39; i++) {
    for (let r = 0; r < rangeDef.length; r++) {
      if (i >= rangeDef[r][0] && i <= rangeDef[r][1]) {
        if (ranges[rangeKeys[r]] > avgRange * 1.1) {
          scores[i] += 3;
        }
        break;
      }
    }
  }

  // 間隔規律：已達/超過平均出現間隔的號碼，依預測時機加分
  const intervals = getIntervalStats();
  for (const s of intervals) {
    if (s.avgGap === null) continue;
    if (s.overdue) {
      scores[s.num] += 15;           // 已到期，隨時可能開出
    } else if (s.predictedIn <= 1) {
      scores[s.num] += 8;            // 即將到期
    }
  }

  // 滯後關聯規律：「X 出現後第 L 期常開 Y」且本期正逢觸發 → 大幅加分（取每個 Y 的最強訊號）
  if (signals && signals.length) {
    const bestByY = {};
    for (const s of signals) {
      if (!bestByY[s.y] || s.count > bestByY[s.y].count) bestByY[s.y] = s;
    }
    for (const y in bestByY) {
      scores[y] += Math.min(bestByY[y].count * 8, 40);
    }
  }

  return scores;
}

function selectNumbers(scores, count) {
  const sorted = Object.entries(scores)
    .map(([n, s]) => ({ num: parseInt(n), score: s }))
    .sort((a, b) => b.score - a.score);

  const selected = [];
  let oddCount = 0, smallCount = 0;

  for (const item of sorted) {
    if (selected.length >= count) break;

    const isOdd = item.num % 2 === 1;
    const isSmall = item.num <= 19;

    if (selected.length >= count - 2 && count >= 4) {
      const oddRatio = oddCount / (selected.length || 1);
      const smallRatio = smallCount / (selected.length || 1);

      if (oddRatio > 0.7 && isOdd) continue;
      if (oddRatio < 0.3 && !isOdd) continue;
      if (smallRatio > 0.7 && isSmall) continue;
      if (smallRatio < 0.3 && !isSmall) continue;
    }

    selected.push(item.num);
    if (isOdd) oddCount++;
    if (isSmall) smallCount++;
  }

  while (selected.length < count) {
    for (let i = 1; i <= 39; i++) {
      if (!selected.includes(i)) {
        selected.push(i);
        if (selected.length >= count) break;
      }
    }
  }

  return selected.sort((a, b) => a - b);
}

function buildReasons(recommended, scores, signals) {
  const freq = getFrequency();
  const missing = getMissingValues();
  const lines = [];
  const pad = n => String(n).padStart(2, '0');

  // 滯後關聯規律（最重要，放最前面）：每個被推薦號碼取其最強的觸發規律
  if (signals && signals.length) {
    const bestByY = {};
    for (const s of signals) {
      if (!bestByY[s.y] || s.count > bestByY[s.y].count) bestByY[s.y] = s;
    }
    const fired = recommended
      .filter(n => bestByY[n])
      .map(n => bestByY[n])
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    fired.forEach(s => {
      lines.push(
        `🎯 規律推薦 ${pad(s.y)}：歷史上「${pad(s.x)}」出現後第 ${s.lag} 期常開出 ${pad(s.y)}` +
        `（${s.opportunities} 次機會中 ${s.count} 次）；目前 ${pad(s.x)} 已 ${s.xMissing} 期未開，本期正逢第 ${s.lag} 期`
      );
    });
  }

  const sortedFreq = Object.values(freq).sort((a, b) => b - a);
  const hotThreshold = sortedFreq[9] || 0;
  const hotNums = recommended.filter(n => freq[n] >= hotThreshold);
  if (hotNums.length > 0) {
    lines.push(`熱號推薦：${hotNums.map(pad).join(', ')}（近期出現頻率較高）`);
  }

  const coldNums = recommended.filter(n => missing[n] >= 8);
  if (coldNums.length > 0) {
    lines.push(`遺漏回補：${coldNums.map(pad).join(', ')}（已多期未開出，具回補潛力）`);
  }

  if (recommended.length >= 4) {
    const oddCount = recommended.filter(n => n % 2 === 1).length;
    const evenCount = recommended.length - oddCount;
    lines.push(`奇偶比 ${oddCount}:${evenCount}`);

    const smallCount = recommended.filter(n => n <= 19).length;
    const bigCount = recommended.length - smallCount;
    lines.push(`大小比 ${bigCount}:${smallCount}（大:小）`);
  }

  return lines;
}

function displayRecommendation(numbers, reasons) {
  const section = document.getElementById('recommendation');
  section.style.display = 'block';

  document.getElementById('rec-numbers').innerHTML = numbers
    .map(n => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join('');

  document.getElementById('rec-reason').innerHTML =
    '<strong>推薦依據：</strong><br>' + reasons.join('<br>');

  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== Cost & Profit Calculation (Correct 539 rules) =====

function displayCostCalculation(numCount, recommended, selectedStars) {
  const section = document.getElementById('cost-section');
  section.style.display = 'block';

  const maxMatch = Math.min(numCount, 5);

  const starData = selectedStars.map(star => {
    const bets = comb(numCount, star.pick);
    const cost = bets * COST_PER_BET;
    const winBets = comb(maxMatch, star.pick);
    const totalPrize = winBets * star.prize;
    return { ...star, bets, cost, winBets, totalPrize };
  });

  const totalBets = starData.reduce((s, d) => s + d.bets, 0);
  const totalCost = starData.reduce((s, d) => s + d.cost, 0);

  const profitLabel = numCount <= 5
    ? `假設 ${numCount} 碼全部中獎`
    : `假設中 5 碼（最大中獎數）`;

  let detailHtml = '<div class="cost-summary-grid">';
  detailHtml += `<div class="cost-summary-item">
    <span class="cost-summary-label">選取號碼數</span>
    <span class="cost-summary-value">${numCount} 碼</span>
  </div>`;
  detailHtml += `<div class="cost-summary-item">
    <span class="cost-summary-label">投注星級</span>
    <span class="cost-summary-value">${selectedStars.map(s => s.name).join('+')}</span>
  </div>`;
  detailHtml += `<div class="cost-summary-item">
    <span class="cost-summary-label">總碰數</span>
    <span class="cost-summary-value">${totalBets.toLocaleString()} 碰</span>
  </div>`;
  detailHtml += `<div class="cost-summary-item">
    <span class="cost-summary-label">單碰成本</span>
    <span class="cost-summary-value">$${COST_PER_BET}</span>
  </div>`;
  detailHtml += `<div class="cost-summary-item highlight">
    <span class="cost-summary-label">總成本</span>
    <span class="cost-summary-value">$${totalCost.toLocaleString()}</span>
  </div>`;
  detailHtml += '</div>';

  document.getElementById('cost-detail').innerHTML = detailHtml;
  document.getElementById('profit-header').textContent = `獲利試算（${profitLabel}）`;

  const tbody = document.getElementById('profit-body');
  let totalPrizeAll = 0;
  let html = '';

  for (const d of starData) {
    const netProfit = d.totalPrize - d.cost;
    const profitClass = netProfit >= 0 ? 'positive' : 'negative';
    totalPrizeAll += d.totalPrize;

    html += `<tr>
      <td>${d.name}</td>
      <td>${d.bets.toLocaleString()} 碰</td>
      <td>$${COST_PER_BET}</td>
      <td>$${d.cost.toLocaleString()}</td>
      <td>$${d.prize.toLocaleString()}</td>
      <td>${d.winBets.toLocaleString()} 碰</td>
      <td>$${d.totalPrize.toLocaleString()}</td>
      <td class="${profitClass}">${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}</td>
    </tr>`;
  }

  tbody.innerHTML = html;

  const totalNetProfit = totalPrizeAll - totalCost;
  const totalProfitClass = totalNetProfit >= 0 ? 'positive' : 'negative';
  document.getElementById('total-cost-cell').innerHTML = `<strong>$${totalCost.toLocaleString()}</strong>`;
  document.getElementById('total-prize-cell').innerHTML = `<strong>$${totalPrizeAll.toLocaleString()}</strong>`;
  document.getElementById('total-profit-cell').innerHTML = `<strong class="${totalProfitClass}">${totalNetProfit >= 0 ? '+' : ''}$${totalNetProfit.toLocaleString()}</strong>`;
}

function comb(n, r) {
  if (r > n) return 0;
  if (r === 0 || r === n) return 1;
  let result = 1;
  for (let i = 0; i < r; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}
