const fs = require('fs');
const content = fs.readFileSync('frontend/src/data/russiaRegionsPaths.ts', 'utf-8');

const regions = ['khakassia', 'kemerovo_oblast', 'altai_krai', 'altai_republic', 'tuva', 'krasnoyarsk_krai'];

for (const r of regions) {
  // Find the entry 
  const pattern = new RegExp("'" + r + "':\\s*\\{\\s*d:\\s*'([^']*)'\\s*,\\s*cx:\\s*([\\d.]+),\\s*cy:\\s*([\\d.]+)");
  const m = content.match(pattern);
  if (m) {
    const pathStr = m[1];
    const cx = m[2];
    const cy = m[3];
    // Extract all numbers from path
    const nums = pathStr.match(/[\d.]+/g).map(Number);
    const xs = [], ys = [];
    for (let i = 0; i < nums.length; i += 2) {
      xs.push(nums[i]);
      ys.push(nums[i + 1]);
    }
    const minX = Math.min(...xs).toFixed(0);
    const minY = Math.min(...ys).toFixed(0);
    const maxX = Math.max(...xs).toFixed(0);
    const maxY = Math.max(...ys).toFixed(0);
    const w = (Math.max(...xs) - Math.min(...xs)).toFixed(0);
    const h = (Math.max(...ys) - Math.min(...ys)).toFixed(0);
    console.log(`${r}: center=(${cx}, ${cy})  bbox=[${minX},${minY} -> ${maxX},${maxY}]  size=${w}x${h}  path_chars=${pathStr.length}`);
  } else {
    console.log(`${r}: NOT FOUND`);
  }
}
