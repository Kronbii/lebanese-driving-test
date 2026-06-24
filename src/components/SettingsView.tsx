import { Database, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";
import type { ProgressSummary } from "../domain/types";
import { arNum, pct } from "../lib/format";

interface SettingsViewProps {
  summary: ProgressSummary;
  onReset: () => void;
}

export function SettingsView({ summary, onReset }: SettingsViewProps) {
  return (
    <main className="settings-view">
      <section className="settings-hero">
        <div>
          <p className="eyebrow">الإعدادات</p>
          <h2>إدارة التطبيق</h2>
        </div>
      </section>

      <section className="settings-grid">
        <article className="settings-panel">
          <div className="settings-panel-title">
            <Smartphone aria-hidden="true" size={20} />
            <h3>حفظ التقدّم</h3>
          </div>
          <div className="settings-row">
            <span>مكان التخزين</span>
            <strong>هذا الجهاز</strong>
          </div>
          <div className="settings-row">
            <span>بنك الأسئلة</span>
            <strong>{arNum(summary.total)}</strong>
          </div>
        </article>

        <article className="settings-panel">
          <div className="settings-panel-title">
            <ShieldCheck aria-hidden="true" size={20} />
            <h3>ملخص التقدّم</h3>
          </div>
          <div className="settings-row">
            <span>التغطية</span>
            <strong>{pct(summary.coveragePct)}</strong>
          </div>
          <div className="settings-row">
            <span>المحاولات</span>
            <strong>{arNum(summary.examsTaken)}</strong>
          </div>
          <div className="settings-row">
            <span>النجاحات</span>
            <strong>{arNum(summary.passes)}</strong>
          </div>
        </article>

        <article className="settings-panel settings-danger">
          <div className="settings-panel-title">
            <Database aria-hidden="true" size={20} />
            <h3>بيانات التقدّم</h3>
          </div>
          <button className="button button-danger settings-reset" type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" size={18} />
            مسح كل التقدّم
          </button>
        </article>
      </section>
    </main>
  );
}
