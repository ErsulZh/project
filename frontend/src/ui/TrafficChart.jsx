import React, { useMemo, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";
import { motion } from "framer-motion";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
);

const DAYS_IN_WINDOW = 30;
const FUTURE_DAYS = 7;

function toLocalIsoDate(value) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit"
  });
}

function computeWeekChangePct(dailyVisits) {
  // last 7 days vs previous 7 days (если данных мало — мягкий fallback).
  const items = [...(dailyVisits || [])]
    .filter((x) => x?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  if (items.length < 2) return null;

  const counts = items.map((x) => Number(x.count) || 0);
  const last7 = counts.slice(-7);
  const prev7 = counts.slice(-14, -7);

  const sum = (arr) => arr.reduce((acc, v) => acc + v, 0);
  const recent = sum(last7);
  const prev = prev7.length ? sum(prev7) : sum(counts.slice(0, Math.max(1, counts.length - last7.length)));

  if (!Number.isFinite(prev) || prev <= 0) return null;
  return ((recent - prev) / prev) * 100;
}

function TrendIcon({ direction }) {
  const isUp = direction === "up";
  const isDown = direction === "down";
  const fill = isUp ? "#34d399" : isDown ? "#fb7185" : "#cbd5f5";
  const path = isUp
    ? "M12 4l7 8h-5v8H10v-8H5l7-8z"
    : isDown
      ? "M12 20l-7-8h5V4h4v8h5l-7 8z"
      : "M4 12h16v2H4z";
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path d={path} fill={fill} />
    </svg>
  );
}

function Heatmap({ dailyVisits, weeks = 10 }) {
  const visitsMap = useMemo(
    () =>
      (dailyVisits || []).reduce((acc, item) => {
        acc[item.date] = Number(item.count) || 0;
        return acc;
      }, {}),
    [dailyVisits]
  );

  const today = useMemo(() => new Date(), []);
  const totalDays = Math.max(1, weeks * 7);

  const days = useMemo(() => {
    // Строим дни от (today - totalDays + 1) до today
    const list = [];
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - (totalDays - 1));
    for (let i = 0; i < totalDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push(d);
    }
    return list;
  }, [today, totalDays]);

  const cells = useMemo(() => {
    const list = [];
    for (const d of days) {
      const iso = toLocalIsoDate(d);
      const count = visitsMap[iso] ?? 0;
      list.push({
        iso,
        count,
        dow: d.getDay() === 0 ? 6 : d.getDay() - 1 // делаем Пн=0..Вс=6
      });
    }
    return list;
  }, [days, visitsMap]);

  const max = useMemo(() => Math.max(1, ...cells.map((c) => c.count)), [cells]);
  const cols = Math.ceil(totalDays / 7);
  const dowLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const grid = useMemo(() => {
    // 7 x cols (по колонкам идут недели)
    const matrix = Array.from({ length: 7 }, () => Array.from({ length: cols }, () => null));
    for (let i = 0; i < cells.length; i += 1) {
      const c = cells[i];
      const col = Math.floor(i / 7);
      matrix[c.dow][col] = c;
    }
    return matrix;
  }, [cells, cols]);

  const colorFor = (value) => {
    const t = Math.max(0, Math.min(1, value / max));
    const alpha = 0.12 + t * 0.65;
    return `rgba(6,182,212,${alpha})`;
  };

  return (
    <div className="heatmap">
      <div className="heatmap-header">
        <h3 className="heatmap-title">Тепловая карта по дням недели</h3>
        <p className="muted heatmap-subtitle">Последние {weeks} недель (цвет = посещения).</p>
      </div>
      <div className="heatmap-grid" style={{ gridTemplateColumns: `auto repeat(${cols}, 1fr)` }}>
        {dowLabels.map((label, rowIdx) => (
          <React.Fragment key={label}>
            <div className="heatmap-row-label">{label}</div>
            {grid[rowIdx].map((c, colIdx) => {
              const count = c?.count ?? 0;
              const iso = c?.iso ?? "";
              return (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${rowIdx}-${colIdx}`}
                  className="heatmap-cell"
                  title={iso ? `${iso}: ${count} посещений` : ""}
                  style={{ backgroundColor: colorFor(count) }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="heatmap-legend">
        <span className="muted">Меньше</span>
        <div className="heatmap-legend-bar">
          {[0.0, 0.25, 0.5, 0.75, 1.0].map((t) => (
            <span
              key={t}
              className="heatmap-legend-step"
              style={{ backgroundColor: `rgba(6,182,212,${0.12 + t * 0.65})` }}
            />
          ))}
        </div>
        <span className="muted">Больше</span>
      </div>
    </div>
  );
}

export default function TrafficChart({ stats, forecast, weekly, maxVisitsThreshold }) {
  const [windowOffset, setWindowOffset] = useState(0);
  const todayIso = toLocalIsoDate(new Date());
  const baseEndIso = useMemo(() => {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() + FUTURE_DAYS);
    return toLocalIsoDate(d);
  }, [todayIso]);

  const visitsMap = useMemo(
    () =>
      stats.dailyVisits.reduce((acc, item) => {
        acc[item.date] = Number(item.count) || 0;
        return acc;
      }, {}),
    [stats.dailyVisits]
  );

  const trendDir = forecast?.prediction?.[0]?.trend ?? "stable";
  const weekChangePct = useMemo(
    () => computeWeekChangePct(stats.dailyVisits),
    [stats.dailyVisits]
  );

  const trendLabel = useMemo(() => {
    const pct = weekChangePct;
    const pctText = typeof pct === "number" && Number.isFinite(pct)
      ? `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`
      : null;

    if (trendDir === "up") return `Рост ${pctText ?? ""} к прошлой неделе`.trim();
    if (trendDir === "down") return `Падение ${pctText ?? ""} к прошлой неделе`.trim();
    return `Стабильно ${pctText ?? ""} к прошлой неделе`.trim();
  }, [trendDir, weekChangePct]);

  const forecastMap = useMemo(
    () =>
      forecast?.prediction?.reduce((acc, item) => {
        acc[item.date] = Number(item.value) || 0;
        return acc;
      }, {}) ?? {},
    [forecast]
  );

  const forecastLowerMap = useMemo(
    () =>
      forecast?.prediction?.reduce((acc, item) => {
        acc[item.date] = Number(item.lower);
        return acc;
      }, {}) ?? {},
    [forecast]
  );

  const forecastUpperMap = useMemo(
    () =>
      forecast?.prediction?.reduce((acc, item) => {
        acc[item.date] = Number(item.upper);
        return acc;
      }, {}) ?? {},
    [forecast]
  );

  const windowDates = useMemo(() => {
    const end = new Date(`${baseEndIso}T00:00:00`);
    end.setDate(end.getDate() + windowOffset * DAYS_IN_WINDOW);
    const start = new Date(end);
    start.setDate(end.getDate() - (DAYS_IN_WINDOW - 1));

    const list = [];
    for (let i = 0; i < DAYS_IN_WINDOW; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      list.push(toLocalIsoDate(day));
    }
    return list;
  }, [baseEndIso, windowOffset]);

  const visitDates = windowDates.map((d) => formatDateLabel(d));
  const visitValues = windowDates.map((date) => (date > todayIso ? null : (visitsMap[date] ?? 0)));
  const forecastValues = windowDates.map((date) =>
    Object.prototype.hasOwnProperty.call(forecastMap, date)
      ? forecastMap[date]
      : null
  );
  const forecastLowerValues = windowDates.map((date) =>
    Object.prototype.hasOwnProperty.call(forecastLowerMap, date)
      ? forecastLowerMap[date]
      : null
  );
  const forecastUpperValues = windowDates.map((date) =>
    Object.prototype.hasOwnProperty.call(forecastUpperMap, date)
      ? forecastUpperMap[date]
      : null
  );

  const visitsDataset = {
    labels: visitDates,
    datasets: [
      {
        label: "Фактические посещения",
        data: visitValues,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79,70,229,0.25)",
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6
      },
      // Доверительный коридор прогноза (Bloomberg-style): заливка между lower и upper.
      {
        label: "CI lower",
        data: forecastLowerValues,
        borderColor: "rgba(249,115,22,0)",
        backgroundColor: "rgba(249,115,22,0)",
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 0,
        tension: 0.3,
        fill: false
      },
      {
        label: "CI upper",
        data: forecastUpperValues,
        borderColor: "rgba(249,115,22,0)",
        backgroundColor: "rgba(249,115,22,0.14)",
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 0,
        tension: 0.3,
        fill: "-1"
      },
      {
        label: "Прогноз",
        data: forecastValues,
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.15)",
        borderDash: [6, 6],
        tension: 0.3,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  const canGoNext = windowDates[windowDates.length - 1] < baseEndIso;
  const rangeTitle = `${windowDates[0]} - ${windowDates[windowDates.length - 1]}`;
  const safeMax = Math.max(1, Number(maxVisitsThreshold) || 1000);
  const tickStep = Math.max(1, Math.ceil(safeMax / 10));

  const weeklyWeeks = weekly?.weeks ?? [];
  const weeklyLabels = weeklyWeeks.map((w) => `W${w.isoWeek}`);
  const weeklyValues = weeklyWeeks.map((w) => Number(w.avg) || 0);
  const weeklyDataset = {
    labels: weeklyLabels,
    datasets: [
      {
        label: "Среднее за неделю",
        data: weeklyValues,
        backgroundColor: "rgba(99,102,241,0.7)",
        borderColor: "rgba(99,102,241,1)",
        borderWidth: 1,
        borderRadius: 10
      }
    ]
  };
  const nextWeekForecast = forecast?.prediction ?? [];
  const nextWeekAvg = nextWeekForecast.length
    ? nextWeekForecast.reduce((acc, x) => acc + (Number(x.value) || 0), 0) / nextWeekForecast.length
    : 0;
  const nextWeekMin = nextWeekForecast.length
    ? Math.min(...nextWeekForecast.map((x) => Number(x.lower) || Number(x.value) || 0))
    : 0;
  const nextWeekMax = nextWeekForecast.length
    ? Math.max(...nextWeekForecast.map((x) => Number(x.upper) || Number(x.value) || 0))
    : 0;

  return (
    <div className="charts-stack">
      <div className="charts-grid">
      <motion.div
        className="card chart-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <div className="chart-title-row">
          <h3 className="chart-title">Посещения по дням и прогноз</h3>
          <span className={`trend-pill ${trendDir}`}>
            <TrendIcon direction={trendDir} />
            <span className="trend-text">{trendLabel}</span>
          </span>
        </div>
        <p className="muted chart-range">{rangeTitle}</p>
        <Line
          data={visitsDataset}
          options={{
            responsive: true,
            animation: { duration: 900, easing: "easeOutQuart" },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  filter(item) {
                    // Скрываем технические линии коридора из легенды.
                    return item.text !== "CI lower" && item.text !== "CI upper";
                  }
                }
              },
              tooltip: {
                mode: "index",
                intersect: false,
                callbacks: {
                  title(items) {
                    const idx = items?.[0]?.dataIndex ?? 0;
                    const iso = windowDates[idx] ?? "";
                    return iso ? `${formatDateLabel(iso)} (${iso})` : "";
                  },
                  label(context) {
                    // Прячем подсказки для технических линий коридора.
                    if (context.dataset.label === "CI lower" || context.dataset.label === "CI upper") {
                      return null;
                    }
                    const value = context.parsed.y;
                    if (value === null || typeof value === "undefined") return null;
                    return `${context.dataset.label}: ${Math.round(value)} посещений`;
                  },
                  afterBody(items) {
                    const idx = items?.[0]?.dataIndex ?? 0;
                    const iso = windowDates[idx];
                    if (!iso) return [];

                    const hasForecast = Object.prototype.hasOwnProperty.call(forecastMap, iso);
                    if (!hasForecast) return [];
                    const low = forecastLowerMap[iso];
                    const up = forecastUpperMap[iso];

                    const lines = [];
                    if (Number.isFinite(low) && Number.isFinite(up)) {
                      lines.push(`Коридор: ${Math.round(low)} – ${Math.round(up)}`);
                    }
                    return lines;
                  }
                }
              }
            },
            interaction: { mode: "index", intersect: false },
            scales: {
              x: {
                ticks: {
                  maxTicksLimit: 10
                }
              },
              y: {
                position: "right",
                beginAtZero: true,
                min: 0,
                max: safeMax,
                ticks: { stepSize: tickStep }
              }
            }
          }}
        />
        <div className="chart-navigation">
          <button
            type="button"
            className="chart-nav-btn"
            onClick={() => setWindowOffset((v) => v - 1)}
          >
            Назад
          </button>
          <button
            type="button"
            className="chart-nav-btn"
            onClick={() => setWindowOffset((v) => v + 1)}
            disabled={!canGoNext}
          >
            Далее
          </button>
        </div>
      </motion.div>

      <div className="chart-side">
        <motion.div
          className="card chart-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          <h3>Среднее по неделям</h3>
          {weeklyWeeks.length === 0 ? (
            <p className="muted">Недостаточно данных для недельной агрегации.</p>
          ) : (
            <Bar
              data={weeklyDataset}
              options={{
                responsive: true,
                animation: { duration: 800, easing: "easeOutQuart" },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      title(items) {
                        const idx = items?.[0]?.dataIndex ?? 0;
                        const w = weeklyWeeks[idx];
                        if (!w) return "";
                        return `Неделя W${w.isoWeek} (${w.startDate} – ${w.endDate})`;
                      },
                      label(ctx) {
                        const idx = ctx.dataIndex ?? 0;
                        const w = weeklyWeeks[idx];
                        const avg = Number(w?.avg) || 0;
                        const change = w?.changePct;
                        const changeText = typeof change === "number" && Number.isFinite(change)
                          ? `, ${change >= 0 ? "+" : ""}${Math.round(change)}% к прошлой`
                          : "";
                        return `Среднее: ${avg.toFixed(1)}${changeText}`;
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                  },
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          )}
        </motion.div>

        <motion.div
          className="card chart-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <h3>Сводка прогноза на неделю</h3>
          <div className="week-summary-grid">
            <div className="week-summary-item">
              <span className="muted">Среднее</span>
              <strong>{nextWeekAvg.toFixed(1)}</strong>
            </div>
            <div className="week-summary-item">
              <span className="muted">Минимум (lower)</span>
              <strong>{Math.round(nextWeekMin)}</strong>
            </div>
            <div className="week-summary-item">
              <span className="muted">Максимум (upper)</span>
              <strong>{Math.round(nextWeekMax)}</strong>
            </div>
            <div className="week-summary-item">
              <span className="muted">Дней в прогнозе</span>
              <strong>{nextWeekForecast.length}</strong>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
      <motion.div
        className="card heatmap-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Heatmap dailyVisits={stats.dailyVisits} weeks={10} />
      </motion.div>
    </div>
  );
}

