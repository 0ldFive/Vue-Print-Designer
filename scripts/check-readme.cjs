/**
 * 校验多语言 README 的文件结构、语言归属与互链完整性。
 *
 * 用法：
 *   node scripts/check-readme.cjs
 *   node scripts/check-readme.cjs <仓库根目录>
 *
 * 约定：
 *   README.md        —— 英文，GitHub 首页默认展示
 *   README.zh-CN.md  —— 简体中文，Gitee 按语言后缀优先展示
 *   README.zh-TW.md  —— 繁体中文
 *   README.ja.md     —— 日语
 *   README.ko.md     —— 韩语
 *   README.de.md     —— 德语
 * 每份文件都必须包含全部语言版本的互链。
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, "..");

const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff]/g;
const KANA_PATTERN = /[\u3040-\u30ff]/g;
const HANGUL_PATTERN = /[\uac00-\ud7af]/g;
const HANT_PATTERN = /[個們時據為設計導體檔與這說]/g;

const LOCALES = [
  { file: "README.md", label: "英文", cjkMax: 20 },
  { file: "README.zh-CN.md", label: "简体中文", cjkMin: 500 },
  { file: "README.zh-TW.md", label: "繁体中文", cjkMin: 500, marker: HANT_PATTERN, markerMin: 20 },
  { file: "README.ja.md", label: "日语", marker: KANA_PATTERN, markerMin: 300 },
  { file: "README.ko.md", label: "韩语", cjkMax: 20, marker: HANGUL_PATTERN, markerMin: 300 },
  { file: "README.de.md", label: "德语", cjkMax: 20, marker: /[äöüßÄÖÜ]/g, markerMin: 20 },
];

const LINK_PREFIX = "https://github.com/0ldFive/Vue-Print-Designer/blob/master/";

const problems = [];

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function readReadme(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) {
    problems.push(`缺少文件：${file}`);
    return null;
  }
  return fs.readFileSync(target, "utf8");
}

function checkLanguage(locale, text) {
  if (text === null) return;
  const cjk = count(text, CJK_PATTERN);
  if (typeof locale.cjkMax === "number" && cjk > locale.cjkMax) {
    problems.push(`${locale.file} 应为${locale.label}，但检出 ${cjk} 个中文字符（上限 ${locale.cjkMax}）`);
  }
  if (typeof locale.cjkMin === "number" && cjk < locale.cjkMin) {
    problems.push(`${locale.file} 应为${locale.label}，但只检出 ${cjk} 个中文字符（下限 ${locale.cjkMin}）`);
  }
  if (locale.marker) {
    const hits = count(text, locale.marker);
    if (hits < locale.markerMin) {
      problems.push(`${locale.file} 应为${locale.label}，但语言特征字符只有 ${hits} 个（下限 ${locale.markerMin}）`);
    }
  }
}

function checkCrossLinks(texts) {
  for (const locale of LOCALES) {
    const text = texts[locale.file];
    if (text === null) continue;
    const missing = LOCALES.filter(
      (other) => other.file !== locale.file && !text.includes(`${LINK_PREFIX}${other.file}`),
    );
    if (missing.length) {
      problems.push(
        `${locale.file} 缺少语言链接：${missing.map((item) => `${LINK_PREFIX}${item.file}`).join("、")}`,
      );
    }
  }
}

function checkStaleFiles() {
  const allowed = new Set(LOCALES.map((locale) => locale.file.toLowerCase()));
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isFile() || !/^readme/i.test(entry.name)) continue;
    if (allowed.has(entry.name.toLowerCase())) continue;
    problems.push(`根目录存在未登记的语言 README：${entry.name}`);
  }
}

const texts = {};
for (const locale of LOCALES) {
  texts[locale.file] = readReadme(locale.file);
  checkLanguage(locale, texts[locale.file]);
}
checkCrossLinks(texts);
checkStaleFiles();

if (problems.length) {
  console.error("README 多语言结构校验失败：");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`README 多语言结构校验通过：${LOCALES.map((locale) => locale.file).join(" / ")}`);
