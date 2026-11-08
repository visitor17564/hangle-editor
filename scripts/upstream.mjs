import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const cache = path.resolve(process.env.HWP_EDITOR_CACHE ?? "node_modules/.cache/hangle-editor");

function checkout(name, owner, revision, folders) {
  const root = path.join(cache, name);
  mkdirSync(root, { recursive: true });
  const git = (...args) => execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.longpaths=true", "-C", root, ...args], { encoding: "utf8" });
  if (!existsSync(path.join(root, ".git"))) {
    git("init", "--quiet");
    git("remote", "add", "origin", `https://github.com/${owner}/${name}.git`);
    git("config", "remote.origin.promisor", "true");
    git("config", "remote.origin.partialclonefilter", "blob:none");
  }
  let head;
  try { head = git("rev-parse", "--verify", "--quiet", "HEAD").trim(); } catch { /* Empty checkout. */ }
  if (head !== revision || !folders.every(folder => existsSync(path.join(root, folder)))) {
    git("fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", revision);
    git("sparse-checkout", "set", "--cone", ...folders);
    git("checkout", "--quiet", "--detach", revision);
  }
  if (git("rev-parse", "HEAD").trim() !== revision || git("status", "--porcelain", "--untracked-files=no").trim()) {
    throw new Error(`Expected unmodified ${name} sources at ${revision} in ${root}`);
  }
  return root;
}

export const hop = checkout("hop", "golbin", "80888af2b8c8a18aea16f824d2d92309a290b1ad", ["apps/studio-host", "config"]);
export const rhwp = checkout("rhwp", "edwardkim", "1a76570e833917d15817415a53c09ad61ab3203f", ["rhwp-studio/src"]);
