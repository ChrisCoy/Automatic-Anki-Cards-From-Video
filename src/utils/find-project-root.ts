import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "url";

function findProjectRoot(startDir = "") {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Root path not found");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = findProjectRoot(__dirname);

export {
  projectRoot
}