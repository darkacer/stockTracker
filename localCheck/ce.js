// const fs = require('fs');
// import fs file module
import fs from 'fs';
// --- Configuration (Matches your Pine Script defaults) ---
const LENGTH = 22;
const MULT = 3.0;
const USE_CLOSE = true;

function calculateCE() {
    const rawData = fs.readFileSync('DATA_RVNL.csv', 'utf8').split('\n');
    // Parse CSV: id,ticker,candle_date,open,high,low,close,updated_at
    const data = rawData.slice(1).map(row => {
        const cols = row.trim().split(',');
        if (cols.length < 7) return null;
        const candleDate = cols[2];
        const open = Number(cols[3]);
        const high = Number(cols[4]);
        const low = Number(cols[5]);
        const close = Number(cols[6]);
        return { candleDate, open, high, low, close };
    }).filter(d => d && d.candleDate && !isNaN(d.close))
      .sort((a, b) => new Date(a.candleDate) - new Date(b.candleDate));

    const total = data.length;

    // 1. Build TR array
    const tr = [];
    tr.push(data[0].high - data[0].low);
    for (let i = 1; i < total; i++) {
        const hl = data[i].high - data[i].low;
        const hc = Math.abs(data[i].high - data[i - 1].close);
        const lc = Math.abs(data[i].low - data[i - 1].close);
        tr.push(Math.max(hl, hc, lc));
    }

    // 2. RMA-ATR: seed with SMA of first LENGTH bars, then Wilder's smoothing
    //    Matches Pine's ta.atr(length) exactly
    let rmaVal = tr.slice(0, LENGTH).reduce((a, b) => a + b, 0) / LENGTH;
    const rmaAtr = new Array(LENGTH).fill(0);
    rmaAtr[LENGTH - 1] = rmaVal;
    for (let i = LENGTH; i < total; i++) {
        rmaVal = (tr[i] + (LENGTH - 1) * rmaVal) / LENGTH;
        rmaAtr.push(rmaVal);
    }

    // 3. Seed longStopPrev/shortStopPrev from first valid bar (i = LENGTH-1)
    //    Matches Pine's nz(longStop[1], longStop) — on bar 0, prev = current (no ratchet)
    const initSlice = data.slice(0, LENGTH);
    const initHighest = USE_CLOSE ? Math.max(...initSlice.map(d => d.close)) : Math.max(...initSlice.map(d => d.high));
    const initLowest  = USE_CLOSE ? Math.min(...initSlice.map(d => d.close)) : Math.min(...initSlice.map(d => d.low));
    const initAtr = rmaAtr[LENGTH - 1] * MULT;
    let longStopPrev  = initHighest - initAtr;
    let shortStopPrev = initLowest  + initAtr;

    // dir at first valid bar (i = LENGTH-1)
    let dir = data[LENGTH - 1].close > shortStopPrev ? 1
            : data[LENGTH - 1].close < longStopPrev  ? -1 : 1;
    let prevDir = dir;

    console.log("Date,Close,Direction,LongStop,ShortStop");

    for (let i = LENGTH; i < total; i++) {
        const atr = rmaAtr[i] * MULT;
        const slice = data.slice(i - LENGTH + 1, i + 1);

        const highest = USE_CLOSE ? Math.max(...slice.map(d => d.close)) : Math.max(...slice.map(d => d.high));
        const lowest  = USE_CLOSE ? Math.min(...slice.map(d => d.close)) : Math.min(...slice.map(d => d.low));

        const longStopRaw  = highest - atr;
        const shortStopRaw = lowest  + atr;

        // Ratchet: matches Pine's nz(longStop[1]) ratchet logic
        const longStop  = data[i - 1].close > longStopPrev  ? Math.max(longStopRaw,  longStopPrev)  : longStopRaw;
        const shortStop = data[i - 1].close < shortStopPrev ? Math.min(shortStopRaw, shortStopPrev) : shortStopRaw;

        prevDir = dir;
        dir = data[i].close > shortStopPrev ? 1
            : data[i].close < longStopPrev  ? -1 : dir;

        longStopPrev  = longStop;
        shortStopPrev = shortStop;

        console.log(`${data[i].candleDate},${data[i].close.toFixed(2)},${dir === 1 ? 'BUY' : 'SELL'},${longStop.toFixed(2)},${shortStop.toFixed(2)}`);
    }
}

calculateCE();