// JavaScript baseline running in a Web Worker.
//
// We run the JS Map aggregation off the main thread because otherwise a
// 10 M-row scan (~1 s on M-series) would freeze the entire tab,
// including the GPU panel we want to compare against. Putting JS in a
// worker is the *most favourable* setup for the JS side: it gets a
// dedicated thread and never blocks the main UI. The point is that
// even under that best case, it doesn't keep up with the GPU.
//
// Protocol:
//   main → worker:  { type: "load", keys, values }            // transferable
//   main → worker:  { type: "setSlider", value }              // cheap, frequent
//   worker → main:  { type: "result", sliderValue, totalSum,
//                     totalCount, top: [{key,sum},...], ms }

let keys = null;
let values = null;
let sliderValue = 0;
let pending = false;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "load") {
    keys = m.keys;
    values = m.values;
    sliderValue = m.sliderValue || 0;
    if (!pending) loop();
  } else if (m.type === "setSlider") {
    sliderValue = m.value;
    if (!pending) loop();
  } else if (m.type === "scenario") {
    keys = m.keys;
    values = m.values;
    sliderValue = m.sliderValue || 0;
    if (!pending) loop();
  }
};

function compute(threshold) {
  // SELECT key, SUM(value), COUNT(*) FROM t WHERE value >= threshold
  // GROUP BY key — by hand, with a Map.
  const acc = new Map();
  let totalSum = 0;
  let totalCount = 0;
  const n = keys.length;
  if (threshold <= 0) {
    for (let i = 0; i < n; i++) {
      const k = keys[i];
      const v = values[i];
      const cur = acc.get(k);
      if (cur) { cur.sum += v; cur.count += 1; }
      else acc.set(k, { sum: v, count: 1 });
      totalSum += v;
      totalCount += 1;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v < threshold) continue;
      const k = keys[i];
      const cur = acc.get(k);
      if (cur) { cur.sum += v; cur.count += 1; }
      else acc.set(k, { sum: v, count: 1 });
      totalSum += v;
      totalCount += 1;
    }
  }
  // Top-20 by sum.
  const rows = [];
  for (const [key, agg] of acc) rows.push({ key, sum: agg.sum, count: agg.count });
  rows.sort((a, b) => b.sum - a.sum);
  return {
    totalSum, totalCount,
    distinct: acc.size,
    top: rows.slice(0, 20),
  };
}

async function loop() {
  pending = true;
  while (true) {
    if (!keys) break;
    const sliderAtStart = sliderValue;
    const t0 = performance.now();
    const r = compute(sliderAtStart);
    const ms = performance.now() - t0;
    self.postMessage({
      type: "result",
      sliderValue: sliderAtStart,
      totalSum: r.totalSum,
      totalCount: r.totalCount,
      distinct: r.distinct,
      top: r.top,
      ms,
    });
    // Yield so postMessage drains and a new setSlider can land.
    await new Promise(r => setTimeout(r, 0));
    // If slider hasn't moved, idle.
    if (sliderValue === sliderAtStart) break;
  }
  pending = false;
}
