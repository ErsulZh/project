import React, { useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import HomePage from "./pages/HomePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

function Layout({ children }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo">
          <span className="logo-dot" />
          <span className="logo-text">NewsPulse</span>
        </div>
        <nav className="nav">
          <Link className="nav-link" to="/">
            Главная
          </Link>
          <Link className="nav-link" to="/about">
            Алгоритм
          </Link>
          <Link className="nav-link nav-link-accent" to="/admin_123">
            Админ-панель
          </Link>
        </nav>
      </header>
      <main className="app-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="app-footer">
        <span>Новости и аналитика трафика в реальном времени.</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/admin_123" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}

