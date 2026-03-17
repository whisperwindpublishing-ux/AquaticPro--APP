const fs = require('fs');
const path = require('path');

const PREFIX = 'ap-';

// Comprehensive Tailwind pattern matching
const TAILWIND_PATTERNS = [
  /^(flex|inline-flex|block|inline-block|inline|grid|inline-grid|hidden|table|flow-root|contents)$/,
  /^(items|justify|content|self|place)-/,
  /^(flex|grow|shrink|basis|order)-/,
  /^(grid-cols|col-span|col-start|col-end|grid-rows|row-span|row-start|row-end|grid-flow|auto-cols|auto-rows)-/,
  /^gap-/,
  /^(overflow|overscroll)-/,
  /^(static|fixed|absolute|relative|sticky)$/,
  /^(inset|top|right|bottom|left|z)-/,
  /^[mp][xytblrs]?-/,
  /^space-[xy]-/,
  /^(w|h|min-w|max-w|min-h|max-h|size)-/,
  /^(text|font|tracking|leading|decoration|underline-offset)-/,
  /^(antialiased|subpixel-antialiased|italic|not-italic)$/,
  /^(uppercase|lowercase|capitalize|normal-case)$/,
  /^(truncate|whitespace|break|hyphens)-/,
  /^(align|indent|vertical)-/,
  /^list-/,
  /^(underline|overline|line-through|no-underline)$/,
  /^(bg|from|via|to)-/,
  /^gradient-/,
  /^(border|rounded|divide|outline|ring)-/,
  /^border$/,
  /^rounded$/,
  /^ring$/,
  /^outline$/,
  /^(shadow|opacity|mix-blend|bg-blend)-/,
  /^shadow$/,
  /^(blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia|backdrop)-/,
  /^(transition|duration|ease|delay|animate)-/,
  /^(scale|rotate|translate|skew|origin|transform)-/,
  /^(cursor|caret|pointer-events|resize|scroll|snap|touch|select|will-change)-/,
  /^accent-/,
  /^appearance-/,
  /^(fill|stroke)-/,
  /^(sr-only|not-sr-only)$/,
  /^aspect-/,
  /^columns-/,
  /^object-/,
  /^(float|clear)-/,
  /^(visible|invisible|collapse)$/,
];

const STATE_PREFIXES = [
  'sm:', 'md:', 'lg:', 'xl:', '2xl:',
  'hover:', 'focus:', 'focus-within:', 'focus-visible:', 'active:', 'visited:',
  'disabled:', 'enabled:', 'checked:', 'required:', 'invalid:', 'valid:',
  'first:', 'last:', 'odd:', 'even:', 'empty:',
  'before:', 'after:', 'placeholder:',
  'dark:', 'group-hover:', 'peer-hover:',
];

function isTailwindClass(cls) {
  if (!cls || typeof cls !== 'string') return false;
  if (cls.startsWith(PREFIX)) return false;
  
  let baseClass = cls;
  for (const prefix of STATE_PREFIXES) {
    if (baseClass.startsWith(prefix)) {
      baseClass = baseClass.slice(prefix.length);
    }
  }
  
  if (baseClass.startsWith('-')) baseClass = baseClass.slice(1);
  if (baseClass.includes('[')) baseClass = baseClass.split('[')[0];
  
  for (const pattern of TAILWIND_PATTERNS) {
    if (pattern.test(baseClass)) return true;
  }
  
  return false;
}

function prefixClass(cls) {
  if (!isTailwindClass(cls)) return cls;
  
  let statePrefix = '';
  let utility = cls;
  
  for (const prefix of STATE_PREFIXES) {
    while (utility.startsWith(prefix)) {
      statePrefix += prefix;
      utility = utility.slice(prefix.length);
    }
  }
  
  if (utility.startsWith('-')) {
    return statePrefix + '-' + PREFIX + utility.slice(1);
  }
  
  return statePrefix + PREFIX + utility;
}

function prefixClassString(str) {
  if (!str) return str;
  return str.split(/\s+/).map(cls => prefixClass(cls.trim())).filter(Boolean).join(' ');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  
  // Process string literals containing Tailwind classes
  modified = modified.replace(
    /(['"])((?:[a-z][\w\-\/\[\]:\.]*\s*)+)\1/gi,
    (match, quote, classes) => {
      if (classes.includes('://') || classes.startsWith('.') || classes.startsWith('#')) {
        return match;
      }
      
      const words = classes.trim().split(/\s+/);
      const hasTailwindClass = words.some(w => isTailwindClass(w));
      
      if (!hasTailwindClass) return match;
      
      const prefixed = prefixClassString(classes);
      return quote + prefixed + quote;
    }
  );
  
  return modified;
}

// Additional UI components
const files = [
  'src/components/ui/Card.tsx',
  'src/components/ui/Badge.tsx',
  'src/components/ui/FormField.tsx',
  'src/components/ui/Label.tsx',
  'src/components/ui/Checkbox.tsx',
].map(f => path.join(__dirname, '..', f));

let updated = 0;
for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const processed = processFile(file);
    if (content !== processed) {
      fs.writeFileSync(file, processed, 'utf8');
      console.log('✓ Updated:', path.basename(file));
      updated++;
    } else {
      console.log('- No changes:', path.basename(file));
    }
  }
}
console.log('\nUpdated', updated, 'files');
