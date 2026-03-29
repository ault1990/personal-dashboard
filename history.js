/* ============================================================
   PersonalDashboard — History Screen
   Weight trend graph, sport-type aggregated metrics & charts.
   ============================================================ */

const HistoryScreen = (() => {
  'use strict';

  const container = document.getElementById('history-content');

  // --- State ---
  let selectedRange = '12W';
  let selectedSport = null;
  let allActivities = [];
  let allBodyMetrics = [];

  // --- Time Range Helpers ---

  function getRangeCutoff(range) {
    const now = new Date();
    switch (range) {
      case '4W':  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28);
      case '12W': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84);
      case '6M':  return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case 'All': return new Date(2000, 0, 1);
      default:    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84);
    }
  }

  function filterByRange(items, dateField) {
    const cutoff = getRangeCutoff(selectedRange);
    return items.filter(item => {
      const d = new Date(item[dateField]);
      return d >= cutoff;
    });
  }

  // --- WeekKey Helpers ---

  function weekKeyToDate(weekKey) {
    // Convert YYYY-WW to approximate Monday date for chart positioning
    const [year, week] = weekKey.split('-').map(Number);
    // Jan 4 is always in ISO week 1
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
    return monday;
  }

  function weekKeyLabel(weekKey) {
    const d = weekKeyToDate(weekKey);
    const month = d.toLocaleString('en-US', { month: 'short' });
    return `${month} ${d.getDate()}`;
  }

  function sortWeekKeys(keys) {
    return [...keys].sort((a, b) => {
      const [ay, aw] = a.split('-').map(Number);
      const [by, bw] = b.split('-').map(Number);
      return ay !== by ? ay - by : aw - bw;
    });
  }

  // --- SVG Chart Rendering ---

  function buildLineChart(dataPoints, { valueLabel = '', accentColor = 'var(--accent)', height = 160 } = {}) {
    // dataPoints: [{ label, value }] ordered chronologically
    if (dataPoints.length === 0) {
      return `<div class="empty-state" style="padding: 24px 0;"><div class="empty-state__text">No data in this range.</div></div>`;
    }

    const W = 360;
    const H = height;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const values = dataPoints.map(d => d.value);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (minV === maxV) { minV -= 1; maxV += 1; }
    const rangeV = maxV - minV;

    function x(i) { return padL + (dataPoints.length === 1 ? plotW / 2 : (i / (dataPoints.length - 1)) * plotW); }
    function y(v) { return padT + plotH - ((v - minV) / rangeV) * plotH; }

    // Grid lines (4 horizontal)
    let gridLines = '';
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const val = minV + (rangeV / gridSteps) * i;
      const yPos = y(val);
      gridLines += `<line x1="${padL}" y1="${yPos}" x2="${W - padR}" y2="${yPos}" stroke="var(--border-subtle)" stroke-width="1"/>`;
      // Y-axis labels
      let label = val;
      if (Math.abs(val) >= 100) label = Math.round(val);
      else label = Number(val.toFixed(1));
      gridLines += `<text x="${padL - 6}" y="${yPos + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)">${label}</text>`;
    }

    // Line path
    let pathD = '';
    dataPoints.forEach((dp, i) => {
      pathD += `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(dp.value).toFixed(1)} `;
    });

    // Area fill
    let areaD = pathD + `L ${x(dataPoints.length - 1).toFixed(1)} ${padT + plotH} L ${x(0).toFixed(1)} ${padT + plotH} Z`;

    // Dots
    let dots = '';
    dataPoints.forEach((dp, i) => {
      dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(dp.value).toFixed(1)}" r="3.5" fill="${accentColor}" stroke="var(--bg-surface)" stroke-width="1.5"/>`;
    });

    // X-axis labels (show ~5 evenly spaced)
    let xLabels = '';
    const labelInterval = Math.max(1, Math.floor(dataPoints.length / 5));
    dataPoints.forEach((dp, i) => {
      if (i % labelInterval === 0 || i === dataPoints.length - 1) {
        xLabels += `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-mono)">${dp.label}</text>`;
      }
    });

    // Generate unique gradient ID
    const gradientId = `chart-grad-${Math.random().toString(36).slice(2, 8)}`;

    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display: block;">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${areaD}" fill="url(#${gradientId})"/>
        <path d="${pathD}" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${xLabels}
      </svg>
    `;
  }

  // --- Sport-Type Metric Definitions ---

  function getMetricConfig(sportType) {
    switch (sportType) {
      case 'Run':
        return {
          label: 'Running',
          stats: (acts) => {
            const totalDist = acts.reduce((s, a) => s + (a.DistanceMeters || 0), 0) / 1609.34;
            const totalMoving = acts.reduce((s, a) => s + (a.MovingTimeSeconds || 0), 0);
            const avgPace = totalDist > 0 ? (totalMoving / 60) / totalDist : 0;
            const hrActs = acts.filter(a => a.AverageHeartRate > 0);
            const avgHR = hrActs.length > 0 ? hrActs.reduce((s, a) => s + a.AverageHeartRate, 0) / hrActs.length : 0;
            const avgElev = acts.length > 0 ? acts.reduce((s, a) => s + (a.TotalElevationGain || 0), 0) / acts.length : 0;
            const distPerSession = acts.length > 0 ? totalDist / acts.length : 0;
            return [
              { label: 'Total Distance', value: `${totalDist.toFixed(1)} mi` },
              { label: 'Sessions', value: acts.length },
              { label: 'Avg Pace', value: avgPace > 0 ? formatPace(avgPace) : '—' },
              { label: 'Avg HR', value: avgHR > 0 ? `${Math.round(avgHR)} bpm` : '—' },
              { label: 'Avg Elev Gain', value: `${Math.round(avgElev * 3.281)} ft` },
              { label: 'Dist/Session', value: `${distPerSession.toFixed(1)} mi`, normalized: true }
            ];
          },
          chartData: (acts) => weeklyAggregate(acts, 'distance'),
          chartLabel: 'Weekly Distance (mi)'
        };

      case 'Ride':
        return {
          label: 'Cycling',
          stats: (acts) => {
            const totalDur = acts.reduce((s, a) => s + (a.MovingTimeSeconds || 0), 0) / 60;
            const wattsActs = acts.filter(a => a.AverageWatts > 0);
            const avgWatts = wattsActs.length > 0 ? wattsActs.reduce((s, a) => s + a.AverageWatts, 0) / wattsActs.length : 0;
            const wWattsActs = acts.filter(a => a.WeightedAverageWatts > 0);
            const avgWWatts = wWattsActs.length > 0 ? wWattsActs.reduce((s, a) => s + a.WeightedAverageWatts, 0) / wWattsActs.length : 0;
            const hrActs = acts.filter(a => a.AverageHeartRate > 0);
            const avgHR = hrActs.length > 0 ? hrActs.reduce((s, a) => s + a.AverageHeartRate, 0) / hrActs.length : 0;
            const cadActs = acts.filter(a => a.AverageCadence > 0);
            const avgCad = cadActs.length > 0 ? cadActs.reduce((s, a) => s + a.AverageCadence, 0) / cadActs.length : 0;
            // kJ/10min — exclude rides without Kilojoules
            const kjActs = acts.filter(a => a.Kilojoules > 0 && a.MovingTimeSeconds > 0);
            const totalKj = kjActs.reduce((s, a) => s + a.Kilojoules, 0);
            const totalKjTime = kjActs.reduce((s, a) => s + a.MovingTimeSeconds, 0);
            const kjPer10 = totalKjTime > 0 ? (totalKj / totalKjTime) * 600 : 0;
            return [
              { label: 'Total Duration', value: `${Math.round(totalDur)} min` },
              { label: 'Sessions', value: acts.length },
              { label: 'Avg Watts', value: avgWatts > 0 ? Math.round(avgWatts) : '—' },
              { label: 'Avg Weighted W', value: avgWWatts > 0 ? Math.round(avgWWatts) : '—' },
              { label: 'Avg HR', value: avgHR > 0 ? `${Math.round(avgHR)} bpm` : '—' },
              { label: 'Avg Cadence', value: avgCad > 0 ? `${Math.round(avgCad)} rpm` : '—' },
              { label: 'kJ/10min', value: kjPer10 > 0 ? kjPer10.toFixed(1) : '—', normalized: true }
            ];
          },
          chartData: (acts) => weeklyAggregate(acts, 'duration'),
          chartLabel: 'Weekly Duration (min)'
        };

      case 'WeightTraining':
        return {
          label: 'Strength',
          stats: (acts) => {
            const totalDur = acts.reduce((s, a) => s + (a.MovingTimeSeconds || 0), 0) / 60;
            const hrActs = acts.filter(a => a.AverageHeartRate > 0);
            const avgHR = hrActs.length > 0 ? hrActs.reduce((s, a) => s + a.AverageHeartRate, 0) / hrActs.length : 0;
            const avgDurPerSession = acts.length > 0 ? totalDur / acts.length : 0;
            return [
              { label: 'Sessions', value: acts.length },
              { label: 'Total Duration', value: `${Math.round(totalDur)} min` },
              { label: 'Avg HR', value: avgHR > 0 ? `${Math.round(avgHR)} bpm` : '—' },
              { label: 'Avg Duration', value: `${Math.round(avgDurPerSession)} min/session`, normalized: true }
            ];
          },
          chartData: (acts) => weeklyAggregate(acts, 'session_count'),
          chartLabel: 'Weekly Sessions'
        };

      case 'Walk':
        return {
          label: 'Walking',
          stats: (acts) => walkHikeStats(acts),
          chartData: (acts) => weeklyAggregate(acts, 'distance'),
          chartLabel: 'Weekly Distance (mi)'
        };

      case 'Hike':
        return {
          label: 'Hiking',
          stats: (acts) => walkHikeStats(acts),
          chartData: (acts) => weeklyAggregate(acts, 'distance'),
          chartLabel: 'Weekly Distance (mi)'
        };

      default:
        return {
          label: sportType,
          stats: (acts) => {
            const totalDur = acts.reduce((s, a) => s + (a.MovingTimeSeconds || 0), 0) / 60;
            const hrActs = acts.filter(a => a.AverageHeartRate > 0);
            const avgHR = hrActs.length > 0 ? hrActs.reduce((s, a) => s + a.AverageHeartRate, 0) / hrActs.length : 0;
            return [
              { label: 'Sessions', value: acts.length },
              { label: 'Total Duration', value: `${Math.round(totalDur)} min` },
              { label: 'Avg HR', value: avgHR > 0 ? `${Math.round(avgHR)} bpm` : '—' }
            ];
          },
          chartData: (acts) => weeklyAggregate(acts, 'session_count'),
          chartLabel: 'Weekly Sessions'
        };
    }
  }

  function walkHikeStats(acts) {
    const totalDist = acts.reduce((s, a) => s + (a.DistanceMeters || 0), 0) / 1609.34;
    const totalMoving = acts.reduce((s, a) => s + (a.MovingTimeSeconds || 0), 0);
    const avgPace = totalDist > 0 ? (totalMoving / 60) / totalDist : 0;
    const hrActs = acts.filter(a => a.AverageHeartRate > 0);
    const avgHR = hrActs.length > 0 ? hrActs.reduce((s, a) => s + a.AverageHeartRate, 0) / hrActs.length : 0;
    const totalElev = acts.reduce((s, a) => s + (a.TotalElevationGain || 0), 0);
    const elevPerMile = totalDist > 0 ? (totalElev * 3.281) / totalDist : 0;
    return [
      { label: 'Total Distance', value: `${totalDist.toFixed(1)} mi` },
      { label: 'Sessions', value: acts.length },
      { label: 'Avg Pace', value: avgPace > 0 ? formatPace(avgPace) : '—' },
      { label: 'Avg HR', value: avgHR > 0 ? `${Math.round(avgHR)} bpm` : '—' },
      { label: 'Avg Elev Gain', value: `${Math.round((totalElev / Math.max(acts.length, 1)) * 3.281)} ft` },
      { label: 'Elev/Mile', value: elevPerMile > 0 ? `${Math.round(elevPerMile)} ft/mi` : '—', normalized: true }
    ];
  }

  function formatPace(paceMinPerMile) {
    const mins = Math.floor(paceMinPerMile);
    const secs = Math.round((paceMinPerMile - mins) * 60);
    return `${mins}:${String(secs).padStart(2, '0')} /mi`;
  }

  // --- Weekly Aggregation ---

  function weeklyAggregate(activities, type) {
    const byWeek = {};
    activities.forEach(a => {
      if (!a.WeekKey) return;
      if (!byWeek[a.WeekKey]) byWeek[a.WeekKey] = [];
      byWeek[a.WeekKey].push(a);
    });

    const sortedKeys = sortWeekKeys(Object.keys(byWeek));
    return sortedKeys.map(wk => {
      const acts = byWeek[wk];
      let value;
      switch (type) {
        case 'distance':
          value = acts.reduce((s, a) => s + (a.DistanceMeters || 0), 0) / 1609.34;
          break;
        case 'duration':
          value = acts.reduce((s, a) => s + (a.MovingTimeSeconds || 0), 0) / 60;
          break;
        case 'session_count':
          value = acts.length;
          break;
        default:
          value = acts.length;
      }
      return { label: weekKeyLabel(wk), value };
    });
  }

  // --- Main Render ---

  async function render() {
    try {
      allActivities = await API.getItems('Activities');
      allBodyMetrics = await API.getItems('BodyMetrics');

      const filteredActivities = filterByRange(allActivities, 'Date');
      const filteredMetrics = filterByRange(allBodyMetrics, 'Date');

      // Discover sport types with data
      const sportTypes = [...new Set(filteredActivities.map(a => a.SportType))].filter(Boolean);

      // Order: known types first, then others alphabetically
      const knownOrder = ['Run', 'Ride', 'WeightTraining', 'Walk', 'Hike'];
      sportTypes.sort((a, b) => {
        const ai = knownOrder.indexOf(a);
        const bi = knownOrder.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });

      // Default selected sport
      if (!selectedSport || !sportTypes.includes(selectedSport)) {
        selectedSport = sportTypes[0] || null;
      }

      let html = '';

      // 1. Time range pills
      html += `<div class="history-range-pills">`;
      ['4W', '12W', '6M', 'All'].forEach(range => {
        html += `<button class="history-pill ${range === selectedRange ? 'history-pill--active' : ''}" data-range="${range}">${range}</button>`;
      });
      html += `</div>`;

      // 2. Weight graph
      html += `
        <div class="card mt-md">
          <div class="card__title">Body Weight</div>
          ${renderWeightChart(filteredMetrics)}
        </div>
      `;

      // 3. Sport-type pills
      if (sportTypes.length > 0) {
        html += `<div class="history-sport-pills mt-md">`;
        sportTypes.forEach(st => {
          const config = getMetricConfig(st);
          html += `<button class="history-pill ${st === selectedSport ? 'history-pill--active' : ''}" data-sport="${st}">${config.label}</button>`;
        });
        html += `</div>`;

        // 4. Selected sport-type content
        if (selectedSport) {
          const sportActs = filteredActivities.filter(a => a.SportType === selectedSport);
          html += renderSportSection(selectedSport, sportActs);
        }
      } else {
        html += `
          <div class="empty-state mt-lg">
            <div class="empty-state__text">No activity data in this range.</div>
          </div>
        `;
      }

      container.innerHTML = html;
      bindEvents();

    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__text text-danger">
            Error loading history: ${err.message}
          </div>
        </div>
      `;
    }
  }

  // --- Weight Chart ---

  function renderWeightChart(metrics) {
    if (metrics.length === 0) {
      return `<div class="empty-state" style="padding: 24px 0;"><div class="empty-state__text">No weigh-ins in this range.</div></div>`;
    }

    // Sort by date ascending
    const sorted = [...metrics].sort((a, b) => new Date(a.Date) - new Date(b.Date));

    const dataPoints = sorted.map(m => {
      const d = new Date(m.Date);
      const label = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
      return { label, value: m.Weight };
    });

    return buildLineChart(dataPoints, { valueLabel: 'lbs', accentColor: 'var(--color-success)', height: 150 });
  }

  // --- Sport Section ---

  function renderSportSection(sportType, activities) {
    const config = getMetricConfig(sportType);
    const stats = config.stats(activities);
    const chartData = config.chartData(activities);

    let html = '';

    // Stat grid
    html += `<div class="history-stat-grid mt-md">`;
    stats.forEach(stat => {
      html += `
        <div class="history-stat-cell ${stat.normalized ? 'history-stat-cell--normalized' : ''}">
          <div class="history-stat-cell__label">${stat.label}</div>
          <div class="history-stat-cell__value">${stat.value}</div>
        </div>
      `;
    });
    html += `</div>`;

    // Chart
    html += `
      <div class="card mt-md">
        <div class="card__title">${escHtml(config.chartLabel)}</div>
        ${buildLineChart(chartData, { height: 160 })}
      </div>
    `;

    return html;
  }

  // --- Event Binding ---

  function bindEvents() {
    // Time range pills
    container.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRange = btn.dataset.range;
        render();
      });
    });

    // Sport-type pills
    container.querySelectorAll('[data-sport]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSport = btn.dataset.sport;
        render();
      });
    });
  }

  // --- Utilities ---

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Listen for tab/screen entry ---

  document.addEventListener('screen:enter', (e) => {
    if (e.detail.screen === 'history-main') render();
  });

  // History tab has no sub-screens, so also listen for tab clicks
  const historyTabBtn = document.querySelector('.tab-bar__item[data-tab="history"]');
  if (historyTabBtn) {
    historyTabBtn.addEventListener('click', () => {
      setTimeout(render, 10);
    });
  }

  return { render };
})();
