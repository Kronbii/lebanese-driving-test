import type { NamespaceMessages } from "./types";
import { common } from "./common";
import { trainer } from "./trainer";
import { settings } from "./settings";
import { signs } from "./signs";
import { staff } from "./staff";
import { admin } from "./admin";
import { live } from "./live";
import { print } from "./print";
import { share } from "./share";
import { projector } from "./projector";
import { school } from "./school";
import { privacy } from "./privacy";
import { embed } from "./embed";

/** Every namespace, keyed by prefix: t("trainer.startExam"). One file per feature area. */
export const NAMESPACES: Record<string, NamespaceMessages> = {
  common,
  trainer,
  settings,
  signs,
  staff,
  admin,
  live,
  print,
  share,
  projector,
  school,
  privacy,
  embed
};
