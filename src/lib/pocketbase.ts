import PocketBase from "pocketbase";
import { getConfig } from "./config";

let pb: PocketBase | null = null;

export function getPb(): PocketBase {
  if (!pb) {
    pb = new PocketBase(getConfig().pocketbaseUrl);
  }
  return pb;
}
