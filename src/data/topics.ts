import type { Localized, TopicId } from "../domain/types";

export interface TopicInfo {
  id: TopicId;
  group: "theory" | "signs";
  label: Localized;
}

export const TOPICS: TopicInfo[] = [
  { id: "gear", group: "theory", label: { ar: "معدات الوقاية والظهور", en: "Protective gear & visibility", fr: "Équipement et visibilité" } },
  { id: "maintenance", group: "theory", label: { ar: "صيانة الدراجة وفحصها", en: "Maintenance & checks", fr: "Entretien et vérifications" } },
  { id: "control", group: "theory", label: { ar: "التحكّم والقيادة والفرملة", en: "Control, braking & steering", fr: "Maîtrise, freinage et direction" } },
  { id: "passengers_loads", group: "theory", label: { ar: "الراكب والحمولة", en: "Passengers & loads", fr: "Passager et chargement" } },
  { id: "road_conditions", group: "theory", label: { ar: "الطقس والليل وسطح الطريق", en: "Weather, night & road surface", fr: "Météo, nuit et chaussée" } },
  { id: "traffic_rules", group: "theory", label: { ar: "قواعد السير والأفضلية", en: "Traffic rules & right of way", fr: "Règles de circulation et priorité" } },
  { id: "hazards", group: "theory", label: { ar: "المخاطر ومستخدمو الطريق", en: "Hazards & other road users", fr: "Dangers et autres usagers" } },
  { id: "rider_fitness", group: "theory", label: { ar: "جاهزية السائق", en: "Rider fitness & attitude", fr: "Aptitude et comportement" } },
  { id: "law_penalties", group: "theory", label: { ar: "القانون والمخالفات والرخص", en: "Law, violations & licences", fr: "Loi, infractions et permis" } },
  { id: "first_aid", group: "theory", label: { ar: "الحوادث والإسعافات الأولية", en: "Accidents & first aid", fr: "Accidents et premiers secours" } },
  { id: "signs_warning", group: "signs", label: { ar: "إشارات التحذير", en: "Warning signs", fr: "Panneaux de danger" } },
  { id: "signs_priority", group: "signs", label: { ar: "إشارات الأفضلية", en: "Priority signs", fr: "Panneaux de priorité" } },
  { id: "signs_prohibition", group: "signs", label: { ar: "إشارات المنع والتقييد", en: "Prohibition signs", fr: "Panneaux d'interdiction" } },
  { id: "signs_mandatory", group: "signs", label: { ar: "الإشارات الإلزامية", en: "Mandatory signs", fr: "Panneaux d'obligation" } },
  { id: "signs_information", group: "signs", label: { ar: "إشارات الإرشاد والخدمات", en: "Information & services", fr: "Indication et services" } }
];

export const TOPIC_IDS = TOPICS.map((topic) => topic.id);

export const TOPICS_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

export function isTopicId(value: unknown): value is TopicId {
  return typeof value === "string" && TOPICS_BY_ID.has(value as TopicId);
}
