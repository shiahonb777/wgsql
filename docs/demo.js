// Demo driver for the wgsql side-by-side race.
//
// Two engines, one slider:
//   left  = JavaScript Map running in a Web Worker (worker.postMessage
//           on every slider input; the worker loops on its own)
//   right = wgsql.aggI32 on WebGPU
//
// The worker keeps the JS computation off the main thread so the
// browser doesn't freeze and we can still render the GPU panel
// frame-by-frame. That's the most generous JS setup possible — the
// argument "well, just use a worker" is dead.

import init, { init as wgsqlInit } from "./wgsql_wasm.js";
import * as duckdb from "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm";
import {
  SCENARIOS, generateScenarioData, labelFor, avatarFor, sublabelFor,
} from "./scenarios.js";

const $ = id => document.getElementById(id);

const log = (line, cls = "") => {
  const pre = $("log");
  const el = document.createElement("span");
  if (cls) el.className = cls;
  el.textContent = line + "\n";
  pre.appendChild(el);
  pre.scrollTop = pre.scrollHeight;
};

const fmt = {
  int: n => n.toLocaleString(),
  money: n => "$" + (n >= 1e9 ? (n/1e9).toFixed(2) + "B"
                  : n >= 1e6 ? (n/1e6).toFixed(2) + "M"
                  : n >= 1e3 ? (n/1e3).toFixed(1) + "K"
                  : n.toFixed(0)),
  num: n => n >= 1e9 ? (n/1e9).toFixed(2) + "B"
          : n >= 1e6 ? (n/1e6).toFixed(2) + "M"
          : n >= 1e3 ? (n/1e3).toFixed(1) + "K"
          : n.toFixed(0),
  ms: n => n < 10 ? n.toFixed(1) + " ms"
          : n < 1000 ? Math.round(n) + " ms"
          : (n/1000).toFixed(2) + " s",
  fps: ms => ms <= 0 ? "—" : (1000/ms).toFixed(1) + " FPS",
};

let engine = null;
let duckConn = null;
let duckdbReady = null;

async function ensureDuckDB() {
  if (duckConn) return;
  if (duckdbReady) return duckdbReady;
  duckdbReady = (async () => {
    log("[duckdb] initializing (one-shot, ~1s)…");
    const t = performance.now();
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);
    const worker = await duckdb.createWorker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    duckConn = await db.connect();
    log(`[duckdb] ready in ${(performance.now()-t).toFixed(0)} ms`);
  })();
  await duckdbReady;
}

async function duckDBGroupBy(keys, values) {
  await duckConn.query(`DROP TABLE IF EXISTS t;`);
  await duckConn.query(`CREATE TABLE t (k INTEGER, v INTEGER);`);

  const tIngestStart = performance.now();
  const enc = new TextEncoder();
  const lines = ["k,v"];
  for (let i = 0; i < keys.length; i++) lines.push(keys[i] + "," + values[i]);
  const csv = enc.encode(lines.join("\n"));
  await duckConn.bindings.registerFileBuffer("data.csv", csv);
  await duckConn.query(`COPY t FROM 'data.csv' (HEADER, FORMAT 'csv');`);
  const tIngest = performance.now() - tIngestStart;

  const tQueryStart = performance.now();
  const result = await duckConn.query(`SELECT k, SUM(v) AS s FROM t GROUP BY k;`);
  const tQuery = performance.now() - tQueryStart;

  return { totalMs: tIngest + tQuery, ingestMs: tIngest, queryMs: tQuery, rows: result.numRows };
}

async function boot() {
  if (!("gpu" in navigator)) {
    $("status").innerHTML =
      "<span class='err'>This browser does not expose WebGPU. " +
      "Try a recent Chrome, Edge, or Safari Technology Preview.</span>";
    return;
  }
  $("status").textContent = "loading WASM module…";
  await init();
  log("[boot] wasm module loaded");
  try {
    engine = await wgsqlInit();
  } catch (e) {
    $("status").innerHTML =
      "<span class='err'>Failed to initialize wgsql engine: " + e + "</span>";
    return;
  }
  $("status").innerHTML =
    "<span class='ok'>wgsql ready</span> on " +
    "<code>" + engine.backend + "</code> / " +
    "<code>" + engine.adapterName + "</code>";
  $("bench-card").style.display = "block";
  $("dashboard").style.display = "block";
  $("versus").style.display = "grid";
  log("[boot] backend=" + engine.backend + " adapter=" + engine.adapterName);

  initScenarios();
  await selectScenario(1); // Equity trades is the most familiar; default to it.
}

// ---------- Scenarios ----------

let currentScenario = 0;
let datasetKeys = null;
let datasetValues = null;
let scenarioLoading = false;

function initScenarios() {
  const tabs = $("tabs");
  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.idx = String(i);
    tab.innerHTML = `<span class="tab-emoji">${s.emoji}</span>` +
                    `<span>${s.title}</span>` +
                    `<span class="tab-meta">${s.metaShort}</span>`;
    tab.addEventListener("click", () => selectScenario(i));
    tabs.appendChild(tab);
  }
}

async function selectScenario(idx) {
  if (scenarioLoading) return;
  scenarioLoading = true;
  for (const t of $("tabs").children) t.classList.remove("active");
  $("tabs").children[idx].classList.add("active");

  const scn = SCENARIOS[idx];
  currentScenario = idx;
  $("scenario-desc").textContent = scn.desc;
  $("slider-label").textContent = scn.sliderLabel;
  $("slider").max = String(scn.sliderMax);
  $("slider").value = "0";
  $("slider-pill").textContent = formatSliderValue(scn, 0);
  $("left-k1-label").textContent = scn.sumLabel;
  $("right-k1-label").textContent = scn.sumLabel;
  $("left-col-label").textContent = scn.sumLabel;
  $("right-col-label").textContent = scn.sumLabel;
  $("left-lb").innerHTML = "";
  $("right-lb").innerHTML = "";

  log(`[scn] loading "${scn.title}" (${fmt.int(scn.n)} rows × ${fmt.int(scn.distinct)} groups)`);

  const t = performance.now();
  const { keys, values } = generateScenarioData(scn);
  log(`[scn] generated in ${(performance.now()-t).toFixed(0)} ms`);
  datasetKeys = keys;
  datasetValues = values;

  // Reset state.
  state.sliderValue = 0;
  state.movesCount = 0;
  state.leftFrames = 0;
  state.rightFrames = 0;
  state.leftLatestSliderForFrame = null;
  state.rightLatestSliderForFrame = null;
  state.leftMs = 0;
  state.rightMs = 0;
  state.leftHistory.length = 0;
  state.rightHistory.length = 0;
  state.gpuRunning = false;
  state.gpuPendingValue = 0;
  updateMoves();
  drawSpark("left-spark", state.leftHistory, "var(--left)");
  drawSpark("right-spark", state.rightHistory, "var(--right)");

  // Hand a copy to the JS worker.
  if (!state.jsWorker) {
    state.jsWorker = new Worker(new URL("./js_worker.js", import.meta.url));
    state.jsWorker.onmessage = onWorkerMessage;
  }
  state.jsWorker.postMessage({
    type: "scenario",
    keys: new Int32Array(keys),
    values: new Int32Array(values),
    sliderValue: 0,
  });

  // Initial GPU frame.
  state.gpuPendingValue = 0;
  if (!state.gpuRunning) gpuLoop().catch(e => log("ERROR: " + e, "err"));

  scenarioLoading = false;
}

function formatSliderValue(scn, v) {
  if (scn.sliderUnit === "$") return "$" + v;
  if (scn.sliderUnit === "¢") return "¢" + v;
  if (scn.sliderUnit === "")  return String(v);
  return v + " " + scn.sliderUnit;
}

// ---------- Driver state ----------

const HISTORY_LEN = 40;

const state = {
  sliderValue: 0,
  movesCount: 0,
  leftFrames: 0,
  rightFrames: 0,
  leftLatestSliderForFrame: null,
  rightLatestSliderForFrame: null,
  leftMs: 0,
  rightMs: 0,
  leftHistory: [],   // recent latencies in ms
  rightHistory: [],
  jsWorker: null,
  gpuRunning: false,
  gpuPendingValue: null,
};

function onWorkerMessage(e) {
  const m = e.data;
  if (m.type !== "result") return;
  state.leftFrames += 1;
  state.leftMs = m.ms;
  state.leftLatestSliderForFrame = m.sliderValue;
  state.leftHistory.push(m.ms);
  if (state.leftHistory.length > HISTORY_LEN) state.leftHistory.shift();
  renderPanel("left", m);
  drawSpark("left-spark", state.leftHistory, "#f87171");
  updateMoves();
}

async function gpuLoop() {
  state.gpuRunning = true;
  while (state.gpuPendingValue !== null) {
    const sliderAtStart = state.gpuPendingValue;
    state.gpuPendingValue = null;
    const scn = SCENARIOS[currentScenario];
    const filter = sliderAtStart > 0 ? { op: "ge", threshold: sliderAtStart } : null;
    const t0 = performance.now();
    const flat = await engine.aggI32(datasetKeys, datasetValues, scn.distinct, filter);
    const ms = performance.now() - t0;
    const stride = 7;
    const rowCount = flat.length / stride;
    let totalSum = 0;
    let totalCount = 0;
    const rows = [];
    for (let i = 0; i < rowCount; i++) {
      const off = i * stride;
      const sum = (flat[off+2] * 4294967296) + (flat[off+1] >>> 0);
      const count = (flat[off+4] * 4294967296) + (flat[off+3] >>> 0);
      rows.push({ key: flat[off], sum, count });
      totalSum += sum;
      totalCount += count;
    }
    rows.sort((a, b) => b.sum - a.sum);
    state.rightFrames += 1;
    state.rightMs = ms;
    state.rightLatestSliderForFrame = sliderAtStart;
    state.rightHistory.push(ms);
    if (state.rightHistory.length > HISTORY_LEN) state.rightHistory.shift();
    renderPanel("right", {
      sliderValue: sliderAtStart,
      totalSum,
      totalCount,
      distinct: rowCount,
      top: rows.slice(0, 20),
      ms,
    });
    drawSpark("right-spark", state.rightHistory, "#4ade80");
    updateMoves();
    await new Promise(r => setTimeout(r, 0));
  }
  state.gpuRunning = false;
}

function formatSum(scn, n) {
  return scn.sumKind === "money" ? fmt.money(n) : fmt.num(n);
}

function renderPanel(side, m) {
  const scn = SCENARIOS[currentScenario];
  $(`${side}-ms`).textContent = fmt.ms(m.ms);
  $(`${side}-fps`).textContent = fmt.fps(m.ms);
  $(`${side}-k1`).textContent = formatSum(scn, m.totalSum);
  $(`${side}-k2`).textContent = fmt.int(m.totalCount);
  $(`${side}-k3`).textContent = fmt.int(m.distinct);

  const lb = $(`${side}-lb`);
  lb.innerHTML = "";
  const top = m.top;
  const max = top.length > 0 ? top[0].sum : 1;
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const row = document.createElement("div");
    row.className = "lb-row";
    const rankCls = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
    const name = labelFor(scn, r.key) || ("#" + r.key);
    const sub  = sublabelFor(scn, r.key);
    const avatar = avatarFor(scn, r.key);
    const widthPct = max > 0 ? (r.sum / max * 100).toFixed(1) : 0;
    row.innerHTML =
      `<span class="lb-rank ${rankCls}">${i+1}</span>` +
      `<div class="lb-avatar">${avatar}</div>` +
      `<div class="lb-name">` +
        `<div class="lb-name-main">${escapeHTML(name)}</div>` +
        (sub ? `<div class="lb-name-sub">${escapeHTML(sub)}</div>` : "") +
      `</div>` +
      `<div class="lb-bar-cell">` +
        `<div class="lb-value">${formatSum(scn, r.sum)}</div>` +
        `<div class="lb-bar-track"><div class="lb-bar-fill" style="width:${widthPct}%"></div></div>` +
      `</div>`;
    lb.appendChild(row);
  }
  if (top.length === 0) {
    lb.innerHTML = `<div class="muted" style="padding:14px;text-align:center;font-size:12.5px">no rows match this filter</div>`;
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[c]));
}

function drawSpark(svgId, data, color) {
  const svg = $(svgId);
  const w = 240, h = 28;
  if (data.length < 2) { svg.innerHTML = ""; return; }
  const max = Math.max(...data, 1);
  const stepX = w / (HISTORY_LEN - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  svg.innerHTML = `
    <polyline fill="none" stroke="${color}" stroke-width="1.5"
              stroke-linejoin="round" stroke-linecap="round"
              points="${points}"
              opacity="0.85" />
  `;
}

function updateMoves() {
  $("moves-count").textContent = String(state.movesCount);
  $("left-frames").textContent = String(state.leftFrames);
  $("right-frames").textContent = String(state.rightFrames);

  const left = state.leftLatestSliderForFrame;
  const right = state.rightLatestSliderForFrame;
  const cur = state.sliderValue;

  const leftLagged = left !== null && left !== cur;
  const rightLagged = right !== null && right !== cur;

  if (leftLagged) {
    $("left-latency").classList.add("lag-warn");
    $("left-tag").innerHTML = `<span class="stale-tag">stale · still computing</span>`;
    $("left-shimmer").classList.add("visible");
  } else {
    $("left-latency").classList.remove("lag-warn");
    $("left-tag").innerHTML = `<span class="live-tag"><span class="live-dot"></span>live</span>`;
    $("left-shimmer").classList.remove("visible");
  }
  if (rightLagged) {
    $("right-latency").classList.add("lag-warn");
    $("right-tag").innerHTML = `<span class="stale-tag">stale</span>`;
  } else {
    $("right-latency").classList.remove("lag-warn");
    $("right-tag").innerHTML = `<span class="live-tag"><span class="live-dot"></span>live</span>`;
  }

  // Hero strip
  if (state.leftMs > 0) {
    $("versus-l-ms").textContent = fmt.ms(state.leftMs);
    $("versus-l-fps").textContent = fmt.fps(state.leftMs);
  }
  if (state.rightMs > 0) {
    $("versus-r-ms").textContent = fmt.ms(state.rightMs);
    $("versus-r-fps").textContent = fmt.fps(state.rightMs);
  }
  if (state.leftMs > 0 && state.rightMs > 0) {
    const x = state.leftMs / state.rightMs;
    $("versus-x").textContent = x.toFixed(1) + "×";
  }
}

// ---------- Slider input ----------

$("slider").addEventListener("input", e => {
  const v = parseInt(e.target.value, 10);
  setSlider(v);
});

function setSlider(v) {
  state.sliderValue = v;
  state.movesCount += 1;
  const scn = SCENARIOS[currentScenario];
  $("slider-pill").textContent = formatSliderValue(scn, v);
  if (state.jsWorker) state.jsWorker.postMessage({ type: "setSlider", value: v });
  state.gpuPendingValue = v;
  if (!state.gpuRunning) gpuLoop().catch(err => log("ERROR: " + err, "err"));
  updateMoves();
}

// ---------- Auto-drag (5s) ----------

let autodragRunning = false;

$("autodrag-btn").addEventListener("click", () => {
  if (autodragRunning) return;
  autodragRunning = true;
  const btn = $("autodrag-btn");
  btn.disabled = true;
  btn.textContent = "▶ Running…";
  const slider = $("slider");
  const max = parseInt(slider.max, 10);
  const start = performance.now();
  const dur = 5000;
  function step() {
    const t = (performance.now() - start) / dur;
    if (t >= 1) {
      slider.value = "0";
      setSlider(0);
      btn.disabled = false;
      btn.textContent = "▶ Auto-drag (5s)";
      autodragRunning = false;
      return;
    }
    // Two full sweeps over 5 s — back and forth. This is what makes
    // the lag visible: the JS panel can't keep up with the rate of
    // change, so it perpetually shows yesterday's slider position.
    const phase = (t * 2) % 1;
    const v = phase < 0.5
      ? Math.round(phase * 2 * max)
      : Math.round((1 - (phase - 0.5) * 2) * max);
    slider.value = String(v);
    setSlider(v);
    requestAnimationFrame(step);
  }
  step();
});

// ---------- Benchmark panel ----------

function makeData(n, gMod) {
  const keys = new Int32Array(n);
  const values = new Int32Array(n);
  let x = 0xCAFEBABE | 0;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    keys[i] = (x >>> 0) % gMod;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    values[i] = (x >>> 0) % 1000;
  }
  return { keys, values };
}

function jsBaselineMain(keys, values) {
  const acc = new Map();
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    acc.set(k, (acc.get(k) || 0) + values[i]);
  }
  return acc;
}

async function runBench() {
  const n = parseInt($("n").value, 10);
  const groups = parseInt($("g").value, 10);
  $("run").disabled = true;
  $("results").style.display = "none";

  log(`[bench] n=${n.toLocaleString()} groups=${groups.toLocaleString()}`);

  const t0 = performance.now();
  const { keys, values } = makeData(n, groups);
  const tGen = performance.now() - t0;
  log(`  gen        ${tGen.toFixed(1)} ms`);

  const t1 = performance.now();
  const cpuMap = jsBaselineMain(keys, values);
  const tCpu = performance.now() - t1;

  const t2 = performance.now();
  const flat = await engine.groupBySumI32(keys, values, groups);
  const tGpu = performance.now() - t2;

  let duckRow = "";
  let speedupVsDuck = null;
  if ($("compareDuck").checked) {
    try {
      await ensureDuckDB();
      const dr = await duckDBGroupBy(keys, values);
      log(`  duckdb     ${dr.totalMs.toFixed(1)} ms (ingest ${dr.ingestMs.toFixed(0)} + query ${dr.queryMs.toFixed(0)})`);
      duckRow = `<tr><td>DuckDB-WASM (CSV ingest + GROUP BY)</td>` +
                `<td class="num">${dr.totalMs.toFixed(1)} ms</td>` +
                `<td class="num">${(n / dr.totalMs / 1000).toFixed(1)} M rows/s</td></tr>`;
      speedupVsDuck = dr.totalMs / tGpu;
    } catch (e) {
      log(`  duckdb     ERROR: ${e}`, "err");
      duckRow = `<tr><td>DuckDB-WASM</td><td class="num err" colspan="2">init failed: ${e}</td></tr>`;
    }
  }

  const gpuRows = flat.length / 3;
  let matches = 0, checked = 0;
  for (let i = 0; i < flat.length && checked < Math.min(50, gpuRows); i += 3) {
    const k = flat[i];
    const lo = flat[i+1] >>> 0;
    const hi = flat[i+2];
    const gpuSum = hi * 4294967296 + lo;
    const cpuSum = cpuMap.get(k);
    if (cpuSum !== undefined && Math.abs(gpuSum - cpuSum) < 1) matches++;
    checked++;
  }
  const correctness = (matches === checked && cpuMap.size === gpuRows)
    ? `<span class='ok'>OK</span> (${gpuRows} groups, ${matches}/${checked} sums match)`
    : `<span class='err'>MISMATCH</span> (gpu ${gpuRows} groups vs cpu ${cpuMap.size}, ${matches}/${checked} sums match)`;

  $("results-body").innerHTML = `
    <tr><td>data generation</td><td class="num">${tGen.toFixed(1)} ms</td><td class="num muted">— host</td></tr>
    <tr><td>JS baseline (Map)</td><td class="num">${tCpu.toFixed(1)} ms</td><td class="num">${(n / tCpu / 1000).toFixed(1)} M rows/s</td></tr>
    ${duckRow}
    <tr><td><strong>wgsql GPU</strong></td><td class="num"><strong>${tGpu.toFixed(1)} ms</strong></td><td class="num"><strong>${(n / tGpu / 1000).toFixed(1)} M rows/s</strong></td></tr>
  `;
  const speedup = tCpu / tGpu;
  const cls = speedup >= 1 ? "ok" : "warn";
  let speedupHtml = `<strong class="${cls}">${speedup.toFixed(2)}× </strong> GPU vs JS Map.`;
  if (speedupVsDuck != null) {
    const cls2 = speedupVsDuck >= 1 ? "ok" : "warn";
    speedupHtml += `&nbsp; <strong class="${cls2}">${speedupVsDuck.toFixed(2)}×</strong> GPU vs DuckDB-WASM.`;
  }
  speedupHtml += `&nbsp; ${correctness}`;
  $("speedup").innerHTML = speedupHtml;
  $("results").style.display = "block";

  log(`  cpu        ${tCpu.toFixed(1)} ms (${(n/tCpu/1000).toFixed(1)} M rows/s)`);
  log(`  gpu        ${tGpu.toFixed(1)} ms (${(n/tGpu/1000).toFixed(1)} M rows/s)`);
  log(`  speedup    ${speedup.toFixed(2)}x vs Map` + (speedupVsDuck != null ? `, ${speedupVsDuck.toFixed(2)}x vs DuckDB-WASM` : ""));

  $("run").disabled = false;
}

$("run").addEventListener("click", () => { runBench().catch(e => log("ERROR: " + e, "err")); });

// ---------- Parquet upload ----------

let loadedParquet = null;

async function loadParquetFile(file) {
  log(`[file] reading ${file.name} (${(file.size/1e6).toFixed(1)} MB)`);
  const buf = new Uint8Array(await file.arrayBuffer());
  await ensureDuckDB();

  await duckConn.bindings.registerFileBuffer(file.name, buf);
  const schema = await duckConn.query(`DESCRIBE SELECT * FROM '${file.name}' LIMIT 0;`);
  const intCols = [];
  for (let i = 0; i < schema.numRows; i++) {
    const name = schema.getChild("column_name").get(i);
    const type = schema.getChild("column_type").get(i);
    if (/^(INT|BIGINT|SMALLINT|TINYINT|UINTEGER|UBIGINT)/.test(type)) intCols.push(name);
  }
  if (intCols.length < 2) {
    throw new Error(`need at least 2 integer columns; saw [${intCols.join(", ")}]`);
  }

  const kCol = $("colK").value.trim() || intCols[0];
  const vCol = $("colV").value.trim() || intCols[1];
  $("colK").placeholder = intCols[0];
  $("colV").placeholder = intCols[1];

  log(`[file] columns: ${kCol}, ${vCol}`);
  const t = performance.now();
  const result = await duckConn.query(
    `SELECT CAST(${kCol} AS INTEGER) k, CAST(${vCol} AS INTEGER) v FROM '${file.name}';`
  );
  const tParse = performance.now() - t;
  log(`[file] parsed in ${tParse.toFixed(0)} ms (${result.numRows.toLocaleString()} rows)`);

  const n = result.numRows;
  const keys = new Int32Array(n);
  const values = new Int32Array(n);
  const kArr = result.getChild("k");
  const vArr = result.getChild("v");
  for (let i = 0; i < n; i++) {
    keys[i] = kArr.get(i);
    values[i] = vArr.get(i);
  }

  loadedParquet = { keys, values, kCol, vCol, fileName: file.name };
  $("runFile").disabled = false;
  $("runFile").classList.remove("ghost");
  $("runFile").textContent = `Run on ${file.name}`;
  $("fileResults").innerHTML = `
    <div class="muted" style="font-size:12px">
      ready: ${n.toLocaleString()} rows, columns
      <code>${kCol}</code> + <code>${vCol}</code>
    </div>
  `;
}

async function runFileBench() {
  if (!loadedParquet) return;
  $("runFile").disabled = true;
  const { keys, values, kCol, vCol, fileName } = loadedParquet;
  const n = keys.length;

  const sample = new Set();
  const sampleN = Math.min(n, 50_000);
  for (let i = 0; i < sampleN; i++) sample.add(keys[i]);
  const groupHint = Math.max(64, sample.size * Math.ceil(n / sampleN) | 0);
  log(`[fileRun] estimated distinct ≈ ${groupHint.toLocaleString()}`);

  const t1 = performance.now();
  const cpu = jsBaselineMain(keys, values);
  const tCpu = performance.now() - t1;

  const t2 = performance.now();
  const flat = await engine.groupBySumI32(keys, values, groupHint);
  const tGpu = performance.now() - t2;

  const gpuRows = flat.length / 3;
  const speedup = tCpu / tGpu;
  const cls = speedup >= 1 ? "ok" : "warn";
  $("fileResults").innerHTML = `
    <table>
      <thead><tr><th>step</th><th class="num">time</th><th class="num">throughput</th></tr></thead>
      <tbody>
        <tr><td>JS Map (${cpu.size.toLocaleString()} groups)</td>
            <td class="num">${tCpu.toFixed(1)} ms</td>
            <td class="num">${(n / tCpu / 1000).toFixed(1)} M rows/s</td></tr>
        <tr><td><strong>wgsql GPU (${gpuRows.toLocaleString()} groups)</strong></td>
            <td class="num"><strong>${tGpu.toFixed(1)} ms</strong></td>
            <td class="num"><strong>${(n / tGpu / 1000).toFixed(1)} M rows/s</strong></td></tr>
      </tbody>
    </table>
    <div style="margin-top:8px">
      <strong class="${cls}">${speedup.toFixed(2)}× </strong> GPU vs JS Map on ${fileName}
      (<code>${n.toLocaleString()}</code> rows, group key = <code>${kCol}</code>)
    </div>
  `;
  log(`[fileRun] cpu ${tCpu.toFixed(0)} ms, gpu ${tGpu.toFixed(0)} ms, speedup ${speedup.toFixed(2)}x`);
  $("runFile").disabled = false;
}

const dz = $("dropzone");
dz.addEventListener("click", () => $("fileInput").click());
dz.addEventListener("dragover", e => { e.preventDefault(); dz.style.borderColor = "var(--accent)"; });
dz.addEventListener("dragleave", e => { e.preventDefault(); dz.style.borderColor = "var(--border)"; });
dz.addEventListener("drop", async e => {
  e.preventDefault();
  dz.style.borderColor = "var(--border)";
  const f = e.dataTransfer.files[0];
  if (f) {
    try { await loadParquetFile(f); }
    catch (err) { log("ERROR: " + err, "err"); $("fileResults").innerHTML = `<span class='err'>${err}</span>`; }
  }
});
$("fileInput").addEventListener("change", async e => {
  const f = e.target.files[0];
  if (f) {
    try { await loadParquetFile(f); }
    catch (err) { log("ERROR: " + err, "err"); $("fileResults").innerHTML = `<span class='err'>${err}</span>`; }
  }
});
$("runFile").addEventListener("click", () => {
  runFileBench().catch(e => log("ERROR: " + e, "err"));
});

boot().catch(e => {
  $("status").innerHTML = "<span class='err'>Boot failed: " + e + "</span>";
  log("ERROR: " + e, "err");
});
