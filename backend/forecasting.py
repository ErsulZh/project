from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import math
from typing import Any, Dict, List, Tuple


Alpha = 0.4


@dataclass(frozen=True)
class ForecastResult:
    prediction: int
    lower: int
    upper: int
    trend: str


def _safe_mean(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _safe_std(values: List[float], mean: float) -> float:
    """
    Стандартное отклонение (population std).
    Для учебного проекта этого достаточно, главное — стабильность на краях.
    """
    n = len(values)
    if n <= 0:
        return 0.0
    var = sum((v - mean) ** 2 for v in values) / n
    return math.sqrt(var)


def _replace_anomalies(values: List[float], mean: float, std: float) -> List[float]:
    """
    Если значение выбивается по правилу:
      abs(v - mean) > 2 * std
    заменяем его на mean.
    """
    if not values:
        return []
    if std <= 0:
        # Если std=0, то выбросов по этому критерию быть не может.
        return list(values)
    limit = 2 * std
    return [mean if abs(v - mean) > limit else v for v in values]


def _linear_trend(values: List[float]) -> Tuple[float, float]:
    """
    Линейный тренд y = a*x + b, где x = 0..n-1.
    Возвращает (a, b).
    """
    n = len(values)
    if n <= 1:
        return 0.0, (values[0] if values else 0.0)

    xs = list(range(n))
    x_mean = _safe_mean([float(x) for x in xs])
    y_mean = _safe_mean(values)

    denom = sum((x - x_mean) ** 2 for x in xs)
    if denom == 0:
        return 0.0, y_mean

    numer = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values))
    a = numer / denom
    b = y_mean - a * x_mean
    return a, b


def _trend_label(a: float) -> str:
    if a > 0:
        return "increasing"
    if a < 0:
        return "decreasing"
    return "stable"


def _seasonality_factors(dates: List[date], values: List[float]) -> Dict[int, float]:
    """
    Сезонность по дням недели.
    Возвращает коэффициент для каждого weekday (0..6):
      season_factor = avg_for_day / overall_avg
    """
    overall_avg = _safe_mean(values)
    if overall_avg == 0:
        return {i: 1.0 for i in range(7)}

    sums = {i: 0.0 for i in range(7)}
    counts = {i: 0 for i in range(7)}
    for d, v in zip(dates, values):
        wd = d.weekday()
        sums[wd] += v
        counts[wd] += 1

    factors: Dict[int, float] = {}
    for wd in range(7):
        if counts[wd] == 0:
            factors[wd] = 1.0
        else:
            avg_for_day = sums[wd] / counts[wd]
            factors[wd] = avg_for_day / overall_avg if overall_avg != 0 else 1.0
    return factors


def _exp_smoothing(values: List[float], alpha: float = Alpha) -> float:
    """
    Экспоненциальное сглаживание:
      S_t = alpha*y_t + (1-alpha)*S_{t-1}
    Начальное значение = первый элемент.
    Возвращает последнее сглаженное значение.
    """
    if not values:
        return 0.0
    s = float(values[0])
    for y in values[1:]:
        s = alpha * float(y) + (1 - alpha) * s
    return s


def _clamp_int(value: float) -> int:
    # Посещения не должны уходить в минус.
    return max(0, int(round(value)))


def forecast_visits(visits: List[Dict[str, object]]) -> Dict[str, object]:
    """
    Прогноз посещаемости на следующий день по временным рядам.

    visits: [{"date":"YYYY-MM-DD","count":int}, ...]

    Алгоритм (по требованиям задачи):
    - последние 14 дней
    - обработка аномалий (2*std)
    - линейный тренд вручную
    - сезонность по дням недели
    - экспоненциальное сглаживание (alpha=0.4)
    - прогноз + доверительный интервал
    """
    # 1) Подготовка данных: сортировка и окно 14 дней
    parsed: List[Tuple[date, float]] = []
    for item in visits or []:
        try:
            d = date.fromisoformat(str(item.get("date")))
            c = float(item.get("count", 0))
        except Exception:
            continue
        parsed.append((d, c))

    parsed.sort(key=lambda t: t[0])
    if len(parsed) > 14:
        parsed = parsed[-14:]

    dates = [d for d, _ in parsed]
    values = [v for _, v in parsed]

    # 10) Краевые случаи: если данных мало, возвращаем среднее
    base_mean = _safe_mean(values)
    if len(values) < 3:
        pred = _clamp_int(base_mean)
        return {
            "prediction": pred,
            "lower": pred,
            "upper": pred,
            "trend": "stable",
        }

    # 2) Аномалии: mean/std, выбросы → mean
    mean = _safe_mean(values)
    std = _safe_std(values, mean)
    cleaned = _replace_anomalies(values, mean, std)

    # 3) Линейный тренд y = a*x+b
    a, b = _linear_trend(cleaned)

    # 4) Сезонность: коэффициенты по дням недели
    season_factors = _seasonality_factors(dates, cleaned)

    # 5) Экспоненциальное сглаживание
    smooth_last = _exp_smoothing(cleaned, alpha=Alpha)

    # 6) Прогноз на следующий день
    next_x = len(cleaned)
    trend_value = a * next_x + b

    last_date = dates[-1]
    next_day = last_date + timedelta(days=1)
    season = season_factors.get(next_day.weekday(), 1.0)

    forecast = ((trend_value + smooth_last) / 2.0) * season

    # 7) Доверительный интервал: ±std
    lower = forecast - std
    upper = forecast + std

    # 8) Тренд
    trend = _trend_label(a)

    # 9) Возврат результата
    return {
        "prediction": _clamp_int(forecast),
        "lower": _clamp_int(lower),
        "upper": _clamp_int(upper),
        "trend": trend,
    }


# ---------------------------
# Forecasting for a week ahead
# ---------------------------

def _parse_visits(visits: List[Dict[str, Any]]) -> List[tuple]:
    parsed = []
    for item in visits:
        try:
            d = date.fromisoformat(str(item["date"]))
            v = max(0, int(item["count"]))
            parsed.append((d, v))
        except (KeyError, ValueError):
            continue
    parsed.sort(key=lambda x: x[0])
    return parsed[-30:]


def _remove_anomalies(values: List[float]) -> List[float]:
    if len(values) < 3:
        return values
    mean = sum(values) / len(values)
    std = math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))
    return [v if abs(v - mean) <= 2 * std else mean for v in values]


def _weighted_linear_trend(values: List[float]) -> tuple:
    n = len(values)
    weights = [0.85 ** (n - 1 - i) for i in range(n)]
    sw = sum(weights)
    sw_x = sum(weights[i] * i for i in range(n))
    sw_y = sum(weights[i] * values[i] for i in range(n))
    sw_xx = sum(weights[i] * i * i for i in range(n))
    sw_xy = sum(weights[i] * i * values[i] for i in range(n))
    denom = sw * sw_xx - sw_x * sw_x
    if abs(denom) < 1e-9:
        slope = 0.0
        intercept = sw_y / sw if sw else 0.0
    else:
        slope = (sw * sw_xy - sw_x * sw_y) / denom
        intercept = (sw_y - slope * sw_x) / sw
    return slope, intercept


def _seasonality_factors(dates: List[date], values: List[float]) -> Dict[int, float]:
    overall_avg = sum(values) / len(values) if values else 1.0
    if overall_avg < 1e-9:
        return {i: 1.0 for i in range(7)}
    dow_sums: Dict[int, list] = {i: [] for i in range(7)}
    for d, v in zip(dates, values):
        dow_sums[d.weekday()].append(v)
    factors = {}
    for dow, vals in dow_sums.items():
        if vals:
            factors[dow] = (sum(vals) / len(vals)) / overall_avg
        else:
            factors[dow] = 1.0
    return factors


def _exp_smoothing(values: List[float], alpha: float = 0.6) -> float:
    smoothed = values[0]
    for v in values[1:]:
        smoothed = alpha * v + (1 - alpha) * smoothed
    return smoothed


def _momentum_factor(values: List[float], window: int = 7) -> float:
    if len(values) < window + 1:
        return 1.0
    recent = values[-window:]
    earlier = values[-window * 2: -window] if len(values) >= window * 2 else values[:-window]
    if not earlier:
        return 1.0
    avg_recent = sum(recent) / len(recent)
    avg_earlier = sum(earlier) / len(earlier)
    if avg_earlier < 1e-9:
        return 1.0
    ratio = avg_recent / avg_earlier
    if ratio > 1:
        return 1.0 + min(0.08, (ratio - 1) * 0.4)
    else:
        return 1.0 - min(0.05, (1 - ratio) * 0.4)


def _clamp_week_int(value: float, max_val: float) -> int:
    return max(0, min(int(round(value)), int(max_val * 3)))


def forecast_week(
    visits: List[Dict[str, Any]],
    days_ahead: int = 7
) -> List[Dict[str, Any]]:
    parsed = _parse_visits(visits)

    if not parsed:
        today = date.today()
        return [
            {"date": (today + timedelta(days=i)).isoformat(),
             "value": 0, "lower": 0, "upper": 0, "trend": "stable"}
            for i in range(1, days_ahead + 1)
        ]

    dates = [p[0] for p in parsed]
    raw_values = [float(p[1]) for p in parsed]

    if len(raw_values) < 3:
        avg = int(round(sum(raw_values) / len(raw_values)))
        today = date.today()
        return [
            {"date": (today + timedelta(days=i)).isoformat(),
             "value": avg, "lower": max(0, avg - 1), "upper": avg + 1, "trend": "stable"}
            for i in range(1, days_ahead + 1)
        ]

    cleaned = _remove_anomalies(raw_values)
    slope, intercept = _weighted_linear_trend(cleaned)
    ema_last = _exp_smoothing(cleaned, alpha=0.6)
    season_factors = _seasonality_factors(dates, cleaned)
    momentum = _momentum_factor(cleaned, window=7)

    mean_c = sum(cleaned) / len(cleaned)
    std = math.sqrt(sum((v - mean_c) ** 2 for v in cleaned) / len(cleaned))
    max_hist = max(cleaned) if cleaned else 1.0

    last_date = dates[-1]
    n = len(cleaned)
    result = []

    for i in range(1, days_ahead + 1):
        future_date = last_date + timedelta(days=i)
        dow = future_date.weekday()
        trend_val = slope * (n - 1 + i) + intercept
        base = 0.5 * trend_val + 0.5 * ema_last
        season = season_factors.get(dow, 1.0)
        forecast_val = base * season * momentum
        value = _clamp_week_int(forecast_val, max_hist)
        lower = _clamp_week_int(forecast_val - std, max_hist)
        upper = _clamp_week_int(forecast_val + std, max_hist)

        if slope > 0.5:
            trend_dir = "up"
        elif slope < -0.5:
            trend_dir = "down"
        else:
            trend_dir = "stable"

        result.append({
            "date": future_date.isoformat(),
            "value": value,
            "lower": lower,
            "upper": upper,
            "trend": trend_dir,
        })

    return result

