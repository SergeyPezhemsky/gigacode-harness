import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const port = process.env.PORT || 3001;
export const serverDir = path.resolve(__dirname, "..");
export const clientDist = path.resolve(serverDir, "../client/dist");
export const gigaDir = path.join(os.homedir(), ".gigacode");
