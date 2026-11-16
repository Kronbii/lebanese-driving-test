import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { FeatureFlag } from "../../../api/types";
import { useI18n } from "../../../i18n/useI18n";
import { useStaff } from "../StaffContext";
import { FEATURE_KEYS } from "./labels";

/** Shows children only when the school's plan includes the feature. */
export function FeatureGate({ flag, children }: { flag: FeatureFlag; children: ReactNode }) {
  const { hasFeature } = useStaff();
  if (hasFeature(flag)) return <>{children}</>;
  return <FeatureLocked flag={flag} />;
}

export function FeatureLocked({ flag }: { flag: FeatureFlag }) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <Lock size={32} aria-hidden="true" />
      <p className="strong">{t("staff.featureLockedTitle", { feature: t(FEATURE_KEYS[flag]) })}</p>
      <p>{t("staff.featureLockedBody")}</p>
    </div>
  );
}

/** For pages only school admins may use. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isSchoolAdmin } = useStaff();
  const { t } = useI18n();
  if (isSchoolAdmin) return <>{children}</>;
  return (
    <div className="empty">
      <Lock size={32} aria-hidden="true" />
      <p className="strong">{t("staff.adminOnly")}</p>
    </div>
  );
}
