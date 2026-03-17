#!/usr/bin/env node
/**
 * Script to add 'ap-' prefix to Tailwind classes in string values within TypeScript/JS objects.
 * Targets theme.ts and similar files where classes are in object properties.
 */

const fs = require('fs');
const path = require('path');

const PREFIX = 'ap-';

// Tailwind class patterns
const TAILWIND_PATTERNS = [
  // Layout
  /^(flex|inline-flex|block|inline-block|inline|grid|inline-grid|hidden|table|flow-root|contents)$/,
  /^(items|justify|content|self|place)-/,
  /^(flex|grow|shrink|basis|order)-/,
  /^(grid-cols|col-span|col-start|col-end|grid-rows|row-span|row-start|row-end|grid-flow|auto-cols|auto-rows)-/,
  /^gap-/,
  /^(overflow|overscroll)-/,
  /^(static|fixed|absolute|relative|sticky)$/,
  /^(inset|top|right|bottom|left|z)-/,
  
  // Spacing
  /^[mp][xytblrs]?-/,
  /^space-[xy]-/,
  
  // Sizing
  /^(w|h|min-w|max-w|min-h|max-h|size)-/,
  
  // Typography
  /^(text|font|tracking|leading|decoration|underline-offset)-/,
  /^(antialiased|subpixel-antialiased|italic|not-italic)$/,
  /^(uppercase|lowercase|capitalize|normal-case)$/,
  /^(truncate|whitespace|break|hyphens)-/,
  /^(align|indent|vertical)-/,
  /^list-/,
  /^(underline|overline|line-through|no-underline)$/,
  
  // Backgrounds
  /^(bg|from|via|to)-/,
  /^gradient-/,
  
  // Borders
  /^(border|rounded|divide|outline|ring)-/,
  /^border$/,
  /^rounded$/,
  /^ring$/,
  /^outline$/,
  
  // Effects
  /^(shadow|opacity|mix-blend|bg-blend)-/,
  /^shadow$/,
  
  // Filters
  /^(blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia|backdrop)-/,
  
  // Transitions
  /^(transition|duration|ease|delay|animate)-/,
  
  // Transforms
  /^(scale|rotate|translate|skew|origin|transform)-/,
  
  // Interactivity
  /^(cursor|caret|pointer-events|resize|scroll|snap|touch|select|will-change)-/,
  /^accent-/,
  /^appearance-/,
  
  // SVG
  /^(fill|stroke)-/,
  
  // Accessibility
  /^(sr-only|not-sr-only)$/,
  
  // Tables
  /^(border-collapse|border-separate|border-spacing|table-auto|table-fixed|caption)-/,
  
  // Aspect
  /^aspect-/,
  
  // Columns
  /^columns-/,
  
  // Object
  /^object-/,
  
  // Float/Clear
  /^(float|clear)-/,
  
  // Visibility
  /^(visible|invisible|collapse)$/,
  
  // Isolation
  /^(isolate|isolation)-/,
];

// State/responsive prefixes
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
  if (cls.startsWith(PREFIX)) return false; // Already prefixed
  
  // Extract the base class (without state prefixes)
  let baseClass = cls;
  for (const prefix of STATE_PREFIXES) {
    if (baseClass.startsWith(prefix)) {
      baseClass = baseClass.slice(prefix.length);
    }
  }
  
  // Handle negative values
  if (baseClass.startsWith('-')) {
    baseClass = baseClass.slice(1);
  }
  
  // Handle arbitrary values
  if (baseClass.includes('[')) {
    baseClass = baseClass.split('[')[0];
  }
  
  // Check against patterns
  for (const pattern of TAILWIND_PATTERNS) {
    if (pattern.test(baseClass)) return true;
  }
  
  return false;
}

function prefixClass(cls) {
  if (!isTailwindClass(cls)) return cls;
  
  // Find where to insert the prefix (after state prefixes but before the utility)
  let statePrefix = '';
  let utility = cls;
  
  for (const prefix of STATE_PREFIXES) {
    while (utility.startsWith(prefix)) {
      statePrefix += prefix;
      utility = utility.slice(prefix.length);
    }
  }
  
  // Handle negative values
  if (utility.startsWith('-')) {
    return statePrefix + '-' + PREFIX + utility.slice(1);
  }
  
  return statePrefix + PREFIX + utility;
}

function prefixClassString(str) {
  if (!str || typeof str !== 'string') return str;
  
  return str.split(/\s+/)
    .map(cls => prefixClass(cls.trim()))
    .filter(Boolean)
    .join(' ');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  
  // Pattern: String values that look like Tailwind class strings
  // Match: 'classes here' or "classes here" in object context
  modified = modified.replace(
    /(['"])((?:[a-z][\w\-\/\[\]:\.]*\s*)+)\1/gi,
    (match, quote, classes) => {
      // Skip if it looks like a non-class string (URLs, selectors, etc.)
      if (classes.includes('://') || classes.includes('content-[') || 
          classes.startsWith('.') || classes.startsWith('#') ||
          classes.includes('/*') || classes.includes('after:content')) {
        return match;
      }
      
      // Check if at least one word looks like a Tailwind class
      const words = classes.trim().split(/\s+/);
      const hasTailwindClass = words.some(w => isTailwindClass(w));
      
      if (!hasTailwindClass) return match;
      
      const prefixed = prefixClassString(classes);
      return quote + prefixed + quote;
    }
  );
  
  return modified;
}

// Files to process
const files = [
  path.join(__dirname, '..', 'src', 'styles', 'theme.ts'),
  path.join(__dirname, '..', 'src', 'components', 'ui', 'Button.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'ui', 'Input.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'ui', 'Select.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'ui', 'Modal.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'ui', 'Table.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'ui', 'Textarea.tsx'),
];

for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const processed = processFile(file);
    if (content !== processed) {
      fs.writeFileSync(file, processed, 'utf8');
      console.log(`✓ Updated: ${path.basename(file)}`);
    } else {
      console.log(`- No changes: ${path.basename(file)}`);
    }
  } else {
    console.log(`✗ Not found: ${file}`);
  }
}

console.log('\nDone!');
