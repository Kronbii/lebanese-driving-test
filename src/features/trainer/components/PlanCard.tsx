import { ListTodo, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useSchool } from "../../../app/SchoolContext";
import { TOPICS_BY_ID } from "../../../data/topics";
import type { PlanStep } from "../../../domain/plan";
import { useI18n } from "../../../i18n/useI18n";

export function stepLink(step: PlanStep): string {
  return step.topic ? `exam/${step.mode}?topic=${step.topic}` : `exam/${step.mode}`;
}

export function PlanCard({ steps }: { steps: PlanStep[] }) {
  const { t, pick } = useI18n();
  const { link } = useSchool();
  return (
    <section className="card stack plan-card">
      <div className="card-title">
        <ListTodo aria-hidden="true" size={20} />
        {t("trainer.planTitle")}
      </div>
      <ol className="list plan-list">
        {steps.map((step, index) => (
          <li key={`${step.kind}-${index}`}>
            <Link className="list-row" to={link(stepLink(step))}>
              <span className="plan-index">{index + 1}</span>
              <span className="grow">
                <strong>
                  {t(`trainer.plan_${step.kind}`, {
                    n: step.count,
                    topic: step.topic ? pick(TOPICS_BY_ID.get(step.topic)?.label) : ""
                  })}
                </strong>
                <span className="muted small block">{t(`trainer.planWhy_${step.kind}`)}</span>
              </span>
              <Play aria-hidden="true" size={18} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
