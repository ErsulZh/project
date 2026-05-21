from __future__ import annotations

import json
from datetime import date, timedelta
import uuid
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, make_response, request
from flask_cors import CORS

try:
    # Когда запускаем как модуль пакета (например, импорт в тестах)
    from .forecasting import forecast_visits, forecast_week  # type: ignore
except Exception:
    # Когда запускаем напрямую: python backend/app.py
    from forecasting import forecast_visits, forecast_week


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"


def ensure_data_file() -> None:
    if not DATA_FILE.exists():
        initial = {"visits": {}, "clicks": {}}
        DATA_FILE.write_text(json.dumps(initial, indent=2, ensure_ascii=False), encoding="utf-8")


def load_data() -> Dict[str, Any]:
    initial = {"visits": {}, "clicks": {}, "visitors": {}}
    ensure_data_file()
    try:
        with DATA_FILE.open("r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                save_data(initial)
                return initial
            data = json.loads(content)
    except (json.JSONDecodeError, OSError):
        # Восстанавливаем файл при повреждении/пустом содержимом.
        save_data(initial)
        return initial

    if not isinstance(data, dict):
        save_data(initial)
        return initial

    data.setdefault("visits", {})
    data.setdefault("clicks", {})
    data.setdefault("visitors", {})
    return data


def save_data(data: Dict[str, Any]) -> None:
    DATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


app = Flask(__name__)
CORS(app)


@app.post("/api/visit")
def visit() -> Any:
    """
    Увеличивает счётчик посещений для текущего дня.

    Важно: считаем 1 уникального посетителя (cookie) 1 раз в день.
    Это защищает от повторного инкремента при refresh и React StrictMode.
    """
    data = load_data()
    today_str = date.today().isoformat()
    visits = data.setdefault("visits", {})
    visitors = data.setdefault("visitors", {})

    visitor_id = request.cookies.get("visitor_id")
    if not visitor_id:
        visitor_id = str(uuid.uuid4())

    last_counted = visitors.get(visitor_id)
    counted = False
    if last_counted != today_str:
        visits[today_str] = int(visits.get(today_str, 0)) + 1
        visitors[visitor_id] = today_str
        counted = True
        save_data(data)

    resp = make_response(
        jsonify(
            {
                "ok": True,
                "date": today_str,
                "count": int(visits.get(today_str, 0)),
                "counted": counted,
            }
        )
    )
    # cookie на 2 года, без авторизации
    resp.set_cookie("visitor_id", visitor_id, max_age=60 * 60 * 24 * 365 * 2, samesite="Lax")
    return resp


@app.post("/api/visit/manual")
def visit_manual() -> Any:
    """Добавляет указанное число посещений в выбранную дату (не позже сегодняшней)."""
    payload = request.get_json(silent=True) or {}
    raw_date = payload.get("date")
    raw_count = payload.get("count", 1)

    if not raw_date:
        return jsonify({"ok": False, "error": "date is required"}), 400

    try:
        target_date = date.fromisoformat(str(raw_date))
    except ValueError:
        return jsonify({"ok": False, "error": "invalid date format"}), 400

    if target_date > date.today():
        return jsonify({"ok": False, "error": "date cannot be in the future"}), 400

    try:
        count = int(raw_count)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "count must be an integer"}), 400

    if count <= 0:
        return jsonify({"ok": False, "error": "count must be greater than 0"}), 400

    data = load_data()
    visits = data.setdefault("visits", {})
    date_key = target_date.isoformat()
    visits[date_key] = int(visits.get(date_key, 0)) + count
    save_data(data)
    return jsonify({"ok": True, "date": date_key, "count": visits[date_key], "added": count})


@app.post("/api/click")
def click() -> Any:
    """Увеличивает счётчик кликов по id новости."""
    news_id = request.args.get("id")
    if not news_id and request.is_json:
        payload = request.get_json(silent=True) or {}
        news_id = payload.get("id")

    if not news_id:
        return jsonify({"ok": False, "error": "id is required"}), 400

    data = load_data()
    clicks = data.setdefault("clicks", {})
    clicks[news_id] = int(clicks.get(news_id, 0)) + 1
    save_data(data)
    return jsonify({"ok": True, "id": news_id, "count": clicks[news_id]})


@app.get("/api/stats")
def stats() -> Any:
    """
    Возвращает агрегированную статистику:
    - ежедневные посещения
    - общее количество посещений
    - количество дней
    - среднее посещений в день
    - клики по новостям
    """
    raw = load_data()
    visits = {k: int(v) for k, v in raw.get("visits", {}).items()}
    clicks = {k: int(v) for k, v in raw.get("clicks", {}).items()}

    daily_visits = [
        {"date": d, "count": visits[d]}
        for d in sorted(visits.keys())
    ]
    total_visits = sum(visits.values())
    days_count = len(visits)
    average_per_day = total_visits / days_count if days_count else 0.0

    return jsonify(
        {
            "dailyVisits": daily_visits,
            "totalVisits": total_visits,
            "daysCount": days_count,
            "averagePerDay": average_per_day,
            "clicks": clicks,
        }
    )


@app.get("/api/stats/weekly")
def stats_weekly() -> Any:
    """
    Агрегация по неделям:
    - avg: среднее за неделю (по имеющимся дням недели)
    - changePct: рост/падение к предыдущей неделе (в %)

    Возвращает список недель по возрастанию.
    """
    raw = load_data()
    visits = {k: int(v) for k, v in raw.get("visits", {}).items()}
    if not visits:
        return jsonify({"weeks": []})

    # группируем по ISO-неделе (год, номер недели)
    buckets: Dict[tuple, Dict[str, Any]] = {}
    for d_str, count in visits.items():
        try:
            d = date.fromisoformat(d_str)
        except ValueError:
            continue
        iso_year, iso_week, _ = d.isocalendar()
        key = (iso_year, iso_week)
        bucket = buckets.setdefault(key, {"sum": 0, "days": 0, "start": d, "end": d})
        bucket["sum"] += int(count)
        bucket["days"] += 1
        if d < bucket["start"]:
            bucket["start"] = d
        if d > bucket["end"]:
            bucket["end"] = d

    keys_sorted = sorted(buckets.keys())
    weeks = []
    prev_avg = None
    for key in keys_sorted:
        bucket = buckets[key]
        days = int(bucket["days"]) or 1
        avg = float(bucket["sum"]) / days
        change_pct = None
        if prev_avg is not None and prev_avg > 0:
            change_pct = ((avg - prev_avg) / prev_avg) * 100.0
        prev_avg = avg

        weeks.append(
            {
                "isoYear": key[0],
                "isoWeek": key[1],
                "startDate": bucket["start"].isoformat(),
                "endDate": bucket["end"].isoformat(),
                "avg": avg,
                "changePct": change_pct,
            }
        )

    return jsonify({"weeks": weeks})


@app.get("/api/forecast")
def forecast() -> Any:
    """
    Простой прогноз на основе среднего количества посещений в день.
    Берём среднее по всем доступным дням и экстраполируем на 7 дней после сегодняшней даты.
    """
    raw = load_data()
    visits = {k: int(v) for k, v in raw.get("visits", {}).items()}
    if not visits:
        return jsonify({"average": 0, "prediction": [], "tsForecast": {"prediction": 0, "lower": 0, "upper": 0, "trend": "stable"}})

    total_visits = sum(visits.values())
    days_count = len(visits)
    visits_list = [{"date": d, "count": visits[d]} for d in sorted(visits.keys())]
    prediction = forecast_week(visits_list, days_ahead=7)
    avg = sum(p["value"] for p in prediction) / len(prediction) if prediction else 0

    visits_list = [{"date": d, "count": visits[d]} for d in sorted(visits.keys())]
    ts_result = forecast_visits(visits_list)

    return jsonify({"average": avg, "prediction": prediction, "tsForecast": ts_result})


@app.get("/api/health")
def health() -> Any:
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    ensure_data_file()
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)

