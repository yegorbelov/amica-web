import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconsDir = path.join(__dirname, '../src/icons');
const animatedDirName = 'animated';
const outFile = path.join(__dirname, '../src/components/Icons/AutoIcons.tsx');

function fixSvgAttributes(svg: string) {
  return svg.replace(/([a-zA-Z0-9:-]+)="([^"]*)"/g, (full, attr, value) => {
    if (!attr.includes('-')) return `${attr}="${value}"`;
    return `${attr.replace(/-([a-z])/g, (_: string, c: string) =>
      c.toUpperCase(),
    )}="${value}"`;
  });
}

function listSvgFilesRecursive(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSvgFilesRecursive(abs));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.svg')) out.push(abs);
  }

  return out;
}

function toIconName(absPath: string) {
  const relFromIcons = path.relative(iconsDir, absPath);
  const extless = relFromIcons.replace(/\.svg$/i, '');
  const parts = extless.split(path.sep);

  // `src/icons/animated/Foo.svg` -> `FooAnimated`
  if (parts[0] === animatedDirName && parts.length >= 2) {
    return `${parts.slice(1).join('')}${'Animated'}`;
  }

  // `src/icons/Foo.svg` -> `Foo`
  return parts.join('');
}

function isInAnimatedFolder(absPath: string) {
  const relFromIcons = path.relative(iconsDir, absPath);
  return relFromIcons.split(path.sep)[0] === animatedDirName;
}

const symbols: { name: string; inner: string; viewBox: string }[] = [];
const animatedComponents: Record<string, { inner: string; viewBox: string }> =
  {};

const files = listSvgFilesRecursive(iconsDir);

files.forEach((absFile) => {
  const name = toIconName(absFile);
  let svgContent = fs.readFileSync(absFile, 'utf8');

  svgContent = svgContent
    .replace(/<\?xml.*?\?>/g, '')
    .replace(/<!DOCTYPE.*?>/g, '');

  const viewBoxMatch = svgContent.match(/<svg[^>]*viewBox=['"]([^'"]+)['"]/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
  const inner =
    svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] || svgContent;

  const isAnimated =
    isInAnimatedFolder(absFile) || /<animate|<animateTransform/.test(svgContent);

  if (isAnimated) {
    animatedComponents[name] = { inner: fixSvgAttributes(inner), viewBox };
  } else {
    symbols.push({ name, inner, viewBox });
  }
});

const iconNamesType = [
  ...symbols.map((s) => `"${s.name}"`),
  ...Object.keys(animatedComponents).map((n) => `"${n}"`),
].join(' | ');

const output = `import React from "react";

export type IconName = ${iconNamesType};
export type IconProps = React.SVGProps<SVGSVGElement> & { name: IconName };


export const IconsSprite = () => (
  <svg style={{ display: "none" }} xmlns="http://www.w3.org/2000/svg">
${symbols
  .map(
    (s) =>
      `    <symbol id="icon-${s.name}" viewBox="${
        s.viewBox
      }">${fixSvgAttributes(s.inner)}</symbol>`,
  )
  .join('\n')}
  </svg>
);

const staticViewBoxes: Record<string, string> = {
${symbols.map((s) => `  "${s.name}": "${s.viewBox}"`).join(',\n')}
};


export const Icon: React.FC<IconProps> = ({ name, ...props }) => {
  const animated = ${JSON.stringify(animatedComponents)}[name];
  if (animated) {
    return (
      <svg viewBox={animated.viewBox} {...props}>
        <g dangerouslySetInnerHTML={{ __html: animated.inner }} />
      </svg>
    );
  }
  

  return <svg viewBox={staticViewBoxes[name]} {...props}><use href={\`#icon-\${name}\`} /></svg>;
};

`;

fs.writeFileSync(outFile, output, 'utf8');
console.log(
  'Generated icons:',
  symbols.length,
  'static,',
  Object.keys(animatedComponents).length,
  'animated',
);
