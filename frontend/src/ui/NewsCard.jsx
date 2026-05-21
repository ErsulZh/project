import React from "react";
import { motion } from "framer-motion";

export default function NewsCard({ news, index, onClick }) {
  return (
    <motion.button
      type="button"
      className="news-card"
      onClick={onClick}
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="pill">{news.category}</span>
      <h3>{news.title}</h3>
      <p>{news.excerpt}</p>
      <span className="card-cta">Читать и отправить клик →</span>
    </motion.button>
  );
}

