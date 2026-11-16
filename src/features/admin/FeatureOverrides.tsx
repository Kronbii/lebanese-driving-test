import type { FeatureFlag, FeatureFlags, Plan } from "../../api/types";
import { PLAN_FEATURES } from "../../api/types";
import { useI18n } from "../../i18n/useI18n";
import { FEATURE_FLAGS, FEATURE_KEYS } from "../staff/shared/labels";

type Choice = "default" | "on" | "off";

interface FeatureOverridesProps {
  plan: Plan;
  value: Partial<FeatureFlags>;
  onChange: (value: Partial<FeatureFlags>) => void;
}

/** Per-flag override (plan default / force on / force off) with the effective value. */
export function FeatureOverrides({ plan, value, onChange }: FeatureOverridesProps) {
  const { t } = useI18n();
  const set = (flag: FeatureFlag, choice: Choice) => {
    const next: Partial<FeatureFlags> = { ...value };
    if (choice === "default") delete next[flag];
    else next[flag] = choice === "on";
    onChange(next);
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t("admin.feature")}</th>
            <th scope="col">{t("admin.planDefault")}</th>
            <th scope="col">{t("admin.override")}</th>
            <th scope="col">{t("admin.effective")}</th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_FLAGS.map((flag) => {
            const planDefault = PLAN_FEATURES[plan][flag];
            const override = value[flag];
            const choice: Choice = override === undefined ? "default" : override ? "on" : "off";
            const effective = override ?? planDefault;
            return (
              <tr key={flag}>
                <th scope="row" className="admin-flag-name">
                  {t(FEATURE_KEYS[flag])}
                </th>
                <td>
                  <span className={`badge ${planDefault ? "success" : ""}`}>{planDefault ? t("admin.on") : t("admin.off")}</span>
                </td>
                <td>
                  <select
                    className="select admin-flag-select"
                    value={choice}
                    aria-label={`${t(FEATURE_KEYS[flag])} — ${t("admin.override")}`}
                    onChange={(event) => set(flag, event.target.value as Choice)}
                  >
                    <option value="default">{t("admin.useDefault")}</option>
                    <option value="on">{t("admin.forceOn")}</option>
                    <option value="off">{t("admin.forceOff")}</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${effective ? "success" : "danger"}`}>{effective ? t("admin.on") : t("admin.off")}</span>
                  {override !== undefined ? <span className="small muted"> · {t("admin.overridden")}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
