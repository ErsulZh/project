import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TrafficChart from "../ui/TrafficChart.jsx";

function toLocalIsoDate(value) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatIsoDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visitThreshold, setVisitThreshold] = useState(() => {
    if (typeof window === "undefined") return 1000;
    const raw = window.localStorage.getItem("visitThreshold");
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
  });
  const hasLoaded = useRef(false);

  const downloadCsv = () => {
    if (!stats) return;
    const visitMap = (stats.dailyVisits || []).reduce((acc, it) => {
      acc[it.date] = Number(it.count) || 0;
      return acc;
    }, {});

    const forecastMap = (forecast?.prediction || []).reduce((acc, it) => {
      acc[it.date] = {
        value: Number(it.value) || 0,
        lower: Number(it.lower),
        upper: Number(it.upper)
      };
      return acc;
    }, {});

    const dates = Array.from(
      new Set([
        ...Object.keys(visitMap),
        ...Object.keys(forecastMap)
      ])
    ).sort();

    const lines = [];
    lines.push("date,actual,forecast,lower,upper");
    for (const d of dates) {
      const actual = Object.prototype.hasOwnProperty.call(visitMap, d) ? visitMap[d] : "";
      const f = forecastMap[d];
      const fv = f ? f.value : "";
      const low = f && Number.isFinite(f.lower) ? f.lower : "";
      const up = f && Number.isFinite(f.upper) ? f.upper : "";
      lines.push(`${d},${actual},${fv},${low},${up}`);
    }

    const csv = `${lines.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits_forecast_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [statsRes, forecastRes, weeklyRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/forecast"),
          fetch("/api/stats/weekly")
        ]);

        if (!statsRes.ok || !forecastRes.ok || !weeklyRes.ok) {
          throw new Error("Ошибка загрузки данных");
        }

        const statsJson = await statsRes.json();
        const forecastJson = await forecastRes.json();
        const weeklyJson = await weeklyRes.json();

        setStats(statsJson);
        setForecast(forecastJson);
        setWeekly(weeklyJson);
      } catch (e) {
        setError(e.message || "Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("visitThreshold", String(visitThreshold));
  }, [visitThreshold]);

  return (
    <div className="page">
      <section className="section">
        <div className="section-header">
          <div>
            <h2>Админ-панель трафика</h2>
            <p>
              Здесь отображается история посещений по дням, клики по новостям и
              прогноз по алгоритму.
            </p>
          </div>
          <button
            type="button"
            className="csv-btn"
            onClick={downloadCsv}
            disabled={!stats}
          >
            Скачать данные (CSV)
          </button>
        </div>

        {loading && <div className="card muted">Загрузка статистики…</div>}
        {error && !loading && (
          <div className="card error">Ошибка: {error}</div>
        )}

        {!loading && !error && stats && (
          <>
            {(() => {
              const todayIso = toLocalIsoDate(new Date());

              const visitsMap = (stats.dailyVisits || []).reduce((acc, item) => {
                acc[item.date] = Number(item.count) || 0;
                return acc;
              }, {});

              const todayCount = visitsMap[todayIso];

              return (
                <div className="stats-grid">
                  <motion.div
                    className="card highlight"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <h3>Сегодня</h3>
                    <p className="stat-number">{todayCount ?? 0}</p>
                    <p className="muted">Всего посещений: {stats.totalVisits}</p>
                  </motion.div>
                  <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <h3>Дней в выборке</h3>
                    <p className="stat-number">{stats.daysCount}</p>
                  </motion.div>
                  <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h3>Среднее посещений в день</h3>
                    <p className="stat-number">
                      {stats.averagePerDay?.toFixed(1) ?? 0}
                    </p>
                  </motion.div>
                </div>
              );
            })()}

            <motion.div
              className="card threshold-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
            >
              <h3>Порог посещений для графика</h3>
              <p className="muted">
                Введите максимальное значение оси Y. График подстроится под этот
                порог.
              </p>
              <input
                type="number"
                className="threshold-input"
                min={1}
                max={1000000}
                value={visitThreshold}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setVisitThreshold(Number.isFinite(next) && next > 0 ? next : 1);
                }}
              />
            </motion.div>

            <TrafficChart
              stats={stats}
              forecast={forecast}
              weekly={weekly}
              maxVisitsThreshold={visitThreshold}
            />

            {forecast && (
              <motion.div
                className="card forecast-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <h3>Прогноз по дням</h3>
                <div className="forecast-grid">
                  <div className="forecast-head">
                    <span>Дата</span>
                    <span>Прогноз</span>
                    <span>Δ</span>
                    <span>Визуально</span>
                  </div>
                  {forecast.prediction.map((item, idx) => {
                    const value = Number(item.value) || 0;
                    const max = Math.max(
                      1,
                      ...forecast.prediction.map((x) => Number(x.value) || 0)
                    );
                    const pct = Math.min(100, Math.round((value / max) * 100));
                    const prevForecast = idx > 0 ? Number(forecast.prediction[idx - 1]?.value) || 0 : null;
                    const lastActual = Number(stats.dailyVisits?.[stats.dailyVisits.length - 1]?.count) || 0;
                    const base = idx === 0 ? lastActual : (prevForecast ?? 0);
                    const changePct = base > 0 ? ((value - base) / base) * 100 : null;
                    const changeText = changePct === null
                      ? "—"
                      : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%`;
                    const changeClass = changePct === null
                      ? "delta-neutral"
                      : changePct >= 0
                        ? "delta-up"
                        : "delta-down";
                    return (
                      <div className="forecast-row" key={item.date}>
                        <span className="forecast-date">
                          {formatIsoDate(item.date)}
                        </span>
                        <span className="forecast-value">
                          {value.toFixed(0)} посещений
                        </span>
                        <span className={`forecast-change ${changeClass}`}>{changeText}</span>
                        <span className="forecast-bar">
                          <span
                            className="forecast-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

