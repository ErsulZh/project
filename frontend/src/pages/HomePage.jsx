import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import DatePicker from "react-datepicker";
import { ru } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import NewsCard from "../ui/NewsCard.jsx";

const NEWS = [
  {
    id: "news-1",
    title: "ИИ помогает анализировать трафик сайтов",
    category: "Технологии",
    excerpt:
      "Новые алгоритмы позволяют предсказывать нагрузку и распределять ресурсы серверов более эффективно."
  },
  {
    id: "news-2",
    title: "Рост онлайн-медиа в 2026 году",
    category: "Медиа",
    excerpt:
      "Посещаемость новостных порталов продолжает расти, а пользователи переходят на персонализированные ленты."
  },
  {
    id: "news-3",
    title: "UX/UI как ключ к удержанию аудитории",
    category: "Дизайн",
    excerpt:
      "Современные интерфейсы с плавными анимациями повышают вовлечённость и время на сайте."
  }
];

async function sendVisit() {
  try {
    await fetch("/api/visit", {
      method: "POST"
    });
  } catch {
    // тихо игнорируем, если бэкенд ещё не запущен
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function HomePage() {
  const hasTrackedVisit = useRef(false);
  const [visitStatus, setVisitStatus] = useState("");
  const [manualDate, setManualDate] = useState(todayIsoDate());
  const [manualDateObj, setManualDateObj] = useState(new Date());
  const [manualCount, setManualCount] = useState(1);

  useEffect(() => {
    if (hasTrackedVisit.current) return;
    hasTrackedVisit.current = true;
    sendVisit();
  }, []);

  const handleNewsClick = async (id) => {
    try {
      await fetch(`/api/click?id=${encodeURIComponent(id)}`, {
        method: "POST"
      });
    } catch {
      // игнорируем
    }
  };

  const handleManualVisit = async () => {
    try {
      const res = await fetch("/api/visit/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: manualDate,
          count: Number(manualCount)
        })
      });
      if (!res.ok) throw new Error("Не удалось добавить посещение");
      setVisitStatus(`Добавлено ${manualCount} посещений на дату ${manualDate}.`);
    } catch {
      setVisitStatus("Ошибка: посещение не добавлено.");
    }
  };

  return (
    <div className="page">
      <section className="hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="badge">Live-аналитика</p>
          <h1>Новостной портал с умной статистикой посещений</h1>
          <p className="hero-subtitle">
            Сохраняем каждое посещение и клик, строим графики по дням и
            прогнозируем будущий трафик.
          </p>
        </motion.div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Лента новостей</h2>
          <p>
            Посещения считаются отдельно, а клики по карточкам идут в отдельную
            метрику кликов.
          </p>
        </div>
        <div className="news-grid">
          {NEWS.map((item, index) => (
            <NewsCard
              key={item.id}
              news={item}
              index={index}
              onClick={() => handleNewsClick(item.id)}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <motion.div
          className="card manual-visit-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <h3>Ручное добавление посещений</h3>
          <p className="muted">
            Выберите дату (до сегодняшнего дня), укажите количество и нажмите
            кнопку. Это полезно для демонстрации проекта в университете.
          </p>
          <div className="manual-visit-fields">
            <label>
              Дата
              <DatePicker
                selected={manualDateObj}
                onChange={(date) => {
                  if (!date) return;
                  setManualDateObj(date);
                  setManualDate(date.toISOString().slice(0, 10));
                }}
                maxDate={new Date()}
                dateFormat="dd.MM.yyyy"
                locale={ru}
                className="manual-date-picker"
                popperPlacement="bottom-start"
              />
            </label>
            <label>
              Количество посещений
              <input
                type="number"
                min={1}
                value={manualCount}
                onChange={(e) => setManualCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          </div>
          <button
            type="button"
            className="manual-visit-btn manual-visit-submit"
            onClick={handleManualVisit}
          >
            Добавить посещение
          </button>
          {visitStatus && <p className="muted">{visitStatus}</p>}
        </motion.div>
      </section>
    </div>
  );
}

