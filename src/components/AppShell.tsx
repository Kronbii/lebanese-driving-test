import { Bike, Home, Play, Settings } from "lucide-react";
import type { ReactNode } from "react";

type AppView = "dashboard" | "exam" | "results" | "settings";

interface AppShellProps {
  activeView: AppView;
  children: ReactNode;
  onHome: () => void;
  onSettings: () => void;
  onStartExam: () => void;
}

export function AppShell({
  activeView,
  children,
  onHome,
  onSettings,
  onStartExam
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className={`topbar ${activeView === "dashboard" ? "topbar-dashboard" : ""}`}>
        <button className="brand-mark" type="button" onClick={onHome} aria-label="الرئيسية">
          <Bike aria-hidden="true" size={22} />
        </button>
        <div className="brand-text">
          <h1>فحص الدراجات الآلية</h1>
          <span>لبنان</span>
        </div>
        {activeView !== "exam" ? (
          <div className={`topbar-actions ${activeView === "dashboard" ? "dashboard-actions" : ""}`}>
            {activeView !== "dashboard" ? (
              <button className="button button-ghost" type="button" onClick={onHome}>
                <Home aria-hidden="true" size={18} />
                الرئيسية
              </button>
            ) : null}
            {activeView !== "settings" ? (
              <button
                className="button button-ghost settings-button"
                type="button"
                onClick={onSettings}
              >
                <Settings aria-hidden="true" size={18} />
                <span>الإعدادات</span>
              </button>
            ) : null}
            {activeView !== "dashboard" ? (
              <button className="button button-primary compact" type="button" onClick={onStartExam}>
                <Play aria-hidden="true" size={18} />
                امتحان
              </button>
            ) : null}
          </div>
        ) : (
          <div className="topbar-actions">
            <button className="button button-ghost" type="button" onClick={onHome}>
              <Home aria-hidden="true" size={18} />
              الرئيسية
            </button>
          </div>
        )}
      </header>

      {children}

      <footer className="site-footer">
        <span>الأسئلة وإشارات الطرق من ملف الفحص الرسمي.</span>
        <span>التقدّم محفوظ على هذا الجهاز فقط.</span>
      </footer>
    </div>
  );
}
