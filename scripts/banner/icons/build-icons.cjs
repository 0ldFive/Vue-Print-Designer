// Rasterizes the framework logos used by the banner pills.
// Requires (not in package.json, install on demand):
//   npm i --no-save @resvg/resvg-js @iconify-json/logos
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const iconSet = require("@iconify-json/logos/icons.json");
const outDir = __dirname;

const wanted = [
  ["vue", "vue"],
  ["react", "react"],
  ["angular", "angular-icon"],
  ["html5", "html-5"],
];

const SIZE = 96;

for (const [file, iconName] of wanted) {
  const icon = iconSet.icons[iconName];
  if (!icon) {
    console.error("missing icon: " + iconName);
    process.exitCode = 1;
    continue;
  }
  const w = icon.width || iconSet.width || 24;
  const h = icon.height || iconSet.height || 24;
  let body = icon.body;
  if (iconName === "angular-icon") {
    body = body.replace(/url\(#[^)]+\)/g, "#dd0031");
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    w +
    " " +
    h +
    '" width="' +
    SIZE +
    '" height="' +
    SIZE +
    '">' +
    body +
    "</svg>";
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: SIZE },
    background: "rgba(0,0,0,0)",
  })
    .render()
    .asPng();
  fs.writeFileSync(path.join(outDir, file + ".png"), png);
  console.log(file + ".png " + png.length + " bytes");
}
