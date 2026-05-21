import React from "react";
import { motion } from "framer-motion";

function Formula({ title, children }) {
  return (
    <div className="card about-card">
      <h3>{title}</h3>
      <div className="about-content">{children}</div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="page">
      <section className="section">
        <div className="section-header">
          <div>
            <h2>Как работает алгоритм прогноза</h2>
            <p>
              Здесь кратко описано, как строится прогноз посещаемости в этом проекте:
              тренд, сезонность, сглаживание, momentum и доверительный коридор.
            </p>
          </div>
        </div>

        <motion.div
          className="about-grid"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <Formula title="1) Подготовка данных">
            <p className="muted">
              Берём список дневных посещений, сортируем по дате и используем последние 30 значений.
              Значения приводим к целым, отрицательные обрезаем до 0.
            </p>
            <pre className="about-code">
{`parsed = sorted(visits by date)[-30:]
values = [max(0, int(count)) for ...]`}
            </pre>
          </Formula>

          <Formula title="2) Аномалии (2σ)">
            <p className="muted">
              Считаем среднее и стандартное отклонение. Если значение выбивается больше чем на
              2*std — заменяем на mean, чтобы прогноз был стабильнее.
            </p>
            <pre className="about-code">
{`if abs(v - mean) > 2*std: v = mean`}
            </pre>
          </Formula>

          <Formula title="3) Взвешенный тренд">
            <p className="muted">
              Строим линейный тренд y = a*x + b, где последние дни важнее (веса 0.85^(...)).
            </p>
            <pre className="about-code">
{`weights[i] = 0.85 ** (n-1-i)
trend(x) = slope*x + intercept`}
            </pre>
          </Formula>

          <Formula title="4) Сезонность по дням недели">
            <p className="muted">
              Для каждого дня недели считаем среднее и делим на общий средний уровень.
              Это даёт коэффициенты сезонности (например, пятница может быть выше среднего).
            </p>
            <pre className="about-code">
{`factor[dow] = avg(dow) / overall_avg`}
            </pre>
          </Formula>

          <Formula title="5) Экспоненциальное сглаживание (EMA)">
            <p className="muted">
              Сглаживаем ряд, чтобы меньше реагировать на шум. В проекте используется alpha = 0.6.
            </p>
            <pre className="about-code">
{`S = y0
S = alpha*y + (1-alpha)*S`}
            </pre>
          </Formula>

          <Formula title="6) Momentum">
            <p className="muted">
              Сравниваем среднее последних 7 дней с более ранним окном и получаем коэффициент,
              который слегка усиливает/ослабляет прогноз.
            </p>
            <pre className="about-code">
{`momentum = clamp(avg_recent / avg_earlier)`}
            </pre>
          </Formula>

          <Formula title="7) Прогноз + доверительный коридор">
            <p className="muted">
              Для каждого будущего дня считаем базу как среднее между трендом и EMA, применяем
              сезонность и momentum. Нижняя/верхняя границы — ±std от прогноза.
            </p>
            <pre className="about-code">
{`base = 0.5*trend + 0.5*ema_last
forecast = base * season(dow) * momentum
lower = forecast - std
upper = forecast + std`}
            </pre>
          </Formula>
        </motion.div>
      </section>
    </div>
  );
}

