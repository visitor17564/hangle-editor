import { readFileSync, writeFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";

const files = {};
for (const name of ["HangleEditor.cs", "Register-HangleEditor.ps1"]) {
  const source = readFileSync(new URL("../windows/" + name, import.meta.url), "utf8");
  files[name] = strToU8(source.replace(/\r\n/g, "\n"));
}
writeFileSync(new URL("../HangleEditor-Windows.zip", import.meta.url),
  zipSync(files, { level: 9, mtime: new Date(2000, 0, 1, 0, 0, 0) }));
