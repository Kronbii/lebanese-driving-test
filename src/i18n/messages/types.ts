import type { Lang } from "../../domain/types";

/** One namespace: the same keys in all three languages. */
export type NamespaceMessages = Record<Lang, Record<string, string>>;
