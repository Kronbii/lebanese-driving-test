import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Flag,
  ListChecks,
  Play,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";
import type { ExamHistoryItem, ProgressSummary, Question, WeakQuestion } from "../domain/types";
import { arNum, EXAM_SIZE, formatDate, PASS_SCORE, pct, questionText } from "../lib/format";

interface DashboardProps {
  history: ExamHistoryItem[];
  questionsById: Map<number, Question>;
  signPreview: Question[];
  summary: ProgressSummary;
  weakQuestions: WeakQuestion[];
  onStartExam: () => void;
  onStartReview: () => void;
}

export function Dashboard({
  history,
  questionsById,
  signPreview,
  summary,
  weakQuestions,
  onStartExam,
  onStartReview
}: DashboardProps) {
  return (
    <main className="dashboard">
      <section className="mobile-dashboard" aria-label="صفحة التدريب">
        <section className="mobile-start-card">
          <h2>ابدأ التدريب</h2>
          <div className="mobile-facts" aria-label="تفاصيل الامتحان">
            <span>
              <Flag aria-hidden="true" size={16} />
              {arNum(EXAM_SIZE)} سؤال
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" size={16} />
              {arNum(PASS_SCORE)} للنجاح
            </span>
          </div>
          <button className="button button-primary mobile-primary-action" type="button" onClick={onStartExam}>
            <Play aria-hidden="true" size={19} />
            ابدأ امتحاناً
          </button>
          <button className="button button-secondary mobile-secondary-action" type="button" onClick={onStartReview}>
            <BookOpenCheck aria-hidden="true" size={18} />
            مراجعة الأخطاء
          </button>
        </section>

        <section className="mobile-quick-stats" aria-label="ملخص التقدّم">
          <div>
            <span>التغطية</span>
            <strong>{pct(summary.coveragePct)}</strong>
          </div>
          <div>
            <span>المحاولات</span>
            <strong>{arNum(summary.examsTaken)}</strong>
          </div>
        </section>

        <details className="mobile-details">
          <summary>التقدّم</summary>
          <div className="mobile-details-body">
            <div className="progress-track" aria-label="نسبة التغطية">
              <span style={{ width: `${summary.coveragePct}%` }} />
            </div>
            <div className="mobile-summary-list">
              <span>لم تُشاهد: <strong>{arNum(summary.unseen)}</strong></span>
              <span>متقنة: <strong>{arNum(summary.mastered)}</strong></span>
              <span>تحتاج تركيزاً: <strong>{arNum(summary.weak)}</strong></span>
            </div>
          </div>
        </details>

        <details className="mobile-details">
          <summary>أسئلة تحتاج مراجعة</summary>
          <div className="mobile-details-body">
            {weakQuestions.length ? (
              <div className="mobile-weak-list">
                {weakQuestions.slice(0, 3).map((item) => {
                  const question = questionsById.get(item.id);
                  if (!question) return null;
                  return (
                    <p key={item.id}>{arNum(item.id)} - {questionText(question)}</p>
                  );
                })}
              </div>
            ) : (
              <p className="mobile-empty">تظهر بعد أول محاولة.</p>
            )}
          </div>
        </details>

        <details className="mobile-details">
          <summary>إشارات الطرق</summary>
          <div className="mobile-sign-row">
            {signPreview.slice(0, 4).map((question) => (
              <img key={question.id} src={question.sign ?? ""} alt={`إشارة رقم ${arNum(question.id)}`} />
            ))}
          </div>
        </details>

        <details className="mobile-details">
          <summary>آخر المحاولات</summary>
          <div className="mobile-details-body">
            {history.length ? (
              <div className="history-list">
                {history.slice(-3).reverse().map((item) => (
                  <div className="history-row" key={`${item.examIndex}-${item.at}`}>
                    <span>{item.mode === "review" ? "مراجعة" : "امتحان"}</span>
                    <strong>نتيجة {arNum(item.score)}</strong>
                    <small>{formatDate(item.at)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mobile-empty">لا توجد محاولات بعد.</p>
            )}
          </div>
        </details>
      </section>

      <section className="practice-panel">
        <div>
          <p className="eyebrow">تدريب الفحص النظري</p>
          <h2>لوحة متابعة واحدة لكل محاولاتك</h2>
          <div className="spec-row" aria-label="تفاصيل الامتحان">
            <span>
              <Flag aria-hidden="true" size={17} />
              {arNum(EXAM_SIZE)} سؤال
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" size={17} />
              {arNum(PASS_SCORE)} للنجاح
            </span>
            <span>
              <ShieldCheck aria-hidden="true" size={17} />
              {arNum(summary.total)} في البنك
            </span>
          </div>
        </div>
        <div className="practice-actions">
          <button className="button button-primary action-button" type="button" onClick={onStartExam}>
            <Play aria-hidden="true" size={19} />
            ابدأ امتحاناً جديداً
          </button>
          <button className="button button-secondary action-button" type="button" onClick={onStartReview}>
            <BookOpenCheck aria-hidden="true" size={19} />
            مراجعة الأخطاء
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="إحصاءات التقدّم">
        <Metric icon={<BarChart3 aria-hidden="true" size={19} />} label="التغطية" value={pct(summary.coveragePct)} />
        <Metric icon={<ShieldCheck aria-hidden="true" size={19} />} label="الإتقان" value={pct(summary.masteryPct)} />
        <Metric icon={<ListChecks aria-hidden="true" size={19} />} label="المحاولات" value={arNum(summary.examsTaken)} />
        <Metric icon={<CheckCircle2 aria-hidden="true" size={19} />} label="النجاحات" value={arNum(summary.passes)} />
      </section>

      <section className="content-grid">
        <div className="main-column">
          <section className="panel progress-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">تغطية البنك</p>
                <h3>أسئلة شوهدت مقابل المتبقي</h3>
              </div>
              <span className="panel-number">شوهدت {arNum(summary.seen)}</span>
            </div>
            <div className="progress-track" aria-label="نسبة التغطية">
              <span style={{ width: `${summary.coveragePct}%` }} />
            </div>
            <div className="chip-row">
              <Chip label="شوهدت" value={summary.seen} />
              <Chip label="لم تُشاهد" value={summary.unseen} />
              <Chip label="متقنة" value={summary.mastered} />
              <Chip label="تحتاج تركيزاً" value={summary.weak} />
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">التركيز التالي</p>
                <h3>أضعف الأسئلة</h3>
              </div>
              <TriangleAlert aria-hidden="true" className="section-icon" size={20} />
            </div>
            {weakQuestions.length ? (
              <div className="review-stack">
                {weakQuestions.map((item) => {
                  const question = questionsById.get(item.id);
                  if (!question) return null;
                  return (
                    <article className="list-item" key={item.id}>
                      <p>{arNum(item.id)} - {questionText(question)}</p>
                      <div className="chip-row compact-chips">
                        <Chip label="المستوى" value={item.level} />
                        <Chip label="الأخطاء" value={item.wrong} />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">تظهر هنا الأسئلة بعد أول محاولة.</p>
            )}
          </section>
        </div>

        <aside className="side-column">
          <section className="panel sign-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">إشارات الطرق</p>
                <h3>عينات من البنك</h3>
              </div>
            </div>
            <div className="sign-grid">
              {signPreview.map((question) => (
                <img key={question.id} src={question.sign ?? ""} alt={`إشارة رقم ${arNum(question.id)}`} />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">السجل</p>
                <h3>آخر المحاولات</h3>
              </div>
            </div>
            {history.length ? (
              <div className="history-list">
                {history.slice(-6).reverse().map((item) => (
                  <div className="history-row" key={`${item.examIndex}-${item.at}`}>
                    <span>{item.mode === "review" ? "مراجعة" : "امتحان"}</span>
                    <strong>نتيجة {arNum(item.score)}</strong>
                    <small>{formatDate(item.at)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">لا توجد محاولات بعد.</p>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Metric({ icon, label, value }: MetricProps) {
  return (
    <div className="metric-card">
      <span className="metric-icon">{icon}</span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface ChipProps {
  label: string;
  value: number;
}

function Chip({ label, value }: ChipProps) {
  return (
    <span className="chip">
      {label}
      <strong>{arNum(value)}</strong>
    </span>
  );
}
