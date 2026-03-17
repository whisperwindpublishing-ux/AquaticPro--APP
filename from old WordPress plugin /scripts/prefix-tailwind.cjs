#!/usr/bin/env node
/**
 * Script to add 'ap-' prefix to all Tailwind CSS classes in the codebase.
 * Run with: node scripts/prefix-tailwind.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const PREFIX = 'ap-';

// Tailwind utility patterns - these are the classes that need prefixing
// This is a comprehensive list of Tailwind utility prefixes
const TAILWIND_PREFIXES = [
  // Layout
  'container', 'box-', 'block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid',
  'table', 'table-', 'flow-root', 'contents', 'hidden', 'visible', 'invisible',
  'float-', 'clear-', 'isolate', 'isolation-', 'object-',
  'overflow-', 'overscroll-', 'position', 'static', 'fixed', 'absolute', 'relative', 'sticky',
  'inset-', 'top-', 'right-', 'bottom-', 'left-', 'z-',
  
  // Flexbox & Grid
  'basis-', 'flex-', 'shrink-', 'grow-', 'order-',
  'grid-cols-', 'col-', 'grid-rows-', 'row-', 'grid-flow-', 'auto-cols-', 'auto-rows-',
  'gap-', 'justify-', 'content-', 'items-', 'self-', 'place-',
  
  // Spacing
  'p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-', 'ps-', 'pe-',
  'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-', 'ms-', 'me-',
  'space-x-', 'space-y-',
  
  // Sizing
  'w-', 'min-w-', 'max-w-', 'h-', 'min-h-', 'max-h-', 'size-',
  
  // Typography
  'font-', 'text-', 'tracking-', 'leading-', 'list-', 'placeholder-',
  'antialiased', 'subpixel-antialiased', 'italic', 'not-italic',
  'normal-nums', 'ordinal', 'slashed-zero', 'lining-nums', 'oldstyle-nums',
  'proportional-nums', 'tabular-nums', 'diagonal-fractions', 'stacked-fractions',
  'underline', 'overline', 'line-through', 'no-underline',
  'decoration-', 'underline-offset-',
  'uppercase', 'lowercase', 'capitalize', 'normal-case',
  'truncate', 'text-ellipsis', 'text-clip', 'whitespace-', 'break-', 'hyphens-',
  'align-', 'indent-', 'vertical-',
  
  // Backgrounds
  'bg-', 'from-', 'via-', 'to-', 'gradient-',
  
  // Borders
  'border', 'border-', 'rounded', 'rounded-', 'divide-', 'outline', 'outline-', 'ring', 'ring-',
  
  // Effects
  'shadow', 'shadow-', 'opacity-', 'mix-blend-', 'bg-blend-',
  
  // Filters
  'blur', 'blur-', 'brightness-', 'contrast-', 'drop-shadow', 'grayscale', 'hue-rotate-',
  'invert', 'saturate-', 'sepia', 'backdrop-',
  
  // Tables
  'border-collapse', 'border-separate', 'border-spacing-', 'table-auto', 'table-fixed',
  'caption-',
  
  // Transitions & Animation
  'transition', 'transition-', 'duration-', 'ease-', 'delay-', 'animate-',
  
  // Transforms
  'scale-', 'rotate-', 'translate-', 'skew-', 'origin-', 'transform',
  
  // Interactivity
  'accent-', 'appearance-', 'cursor-', 'caret-', 'pointer-events-', 'resize', 'resize-',
  'scroll-', 'snap-', 'touch-', 'select-', 'will-change-',
  
  // SVG
  'fill-', 'stroke-',
  
  // Accessibility
  'sr-only', 'not-sr-only', 'forced-color-adjust-',
  
  // Responsive/State prefixes - these come before utilities
  'sm:', 'md:', 'lg:', 'xl:', '2xl:',
  'hover:', 'focus:', 'focus-within:', 'focus-visible:', 'active:', 'visited:',
  'target:', 'first:', 'last:', 'only:', 'odd:', 'even:', 'first-of-type:',
  'last-of-type:', 'only-of-type:', 'empty:', 'disabled:', 'enabled:', 'checked:',
  'indeterminate:', 'default:', 'required:', 'valid:', 'invalid:', 'in-range:',
  'out-of-range:', 'placeholder-shown:', 'autofill:', 'read-only:',
  'before:', 'after:', 'first-letter:', 'first-line:', 'marker:', 'selection:',
  'file:', 'backdrop:', 'placeholder:', 'dark:', 'motion-safe:', 'motion-reduce:',
  'contrast-more:', 'contrast-less:', 'portrait:', 'landscape:', 'print:',
  'group-hover:', 'group-focus:', 'peer-hover:', 'peer-focus:',
  
  // Aspect ratio
  'aspect-',
  
  // Columns
  'columns-', 'break-',
  
  // Prose (typography plugin)
  'prose',
];

// Classes that should NOT be prefixed (custom classes, third-party, etc.)
const SKIP_PATTERNS = [
  /^excalidraw/,
  /^lucide-/,
  /^mantine-/,
  /^bn-/,           // BlockNote
  /^react-/,
  /^ProseMirror/,
  /^aqua-/,         // Already custom
  /^icon-/,
  /^tippy-/,
  /^\$/,            // Template variables
  /^\{/,            // JSX expressions
  /^#/,             // IDs
  /^\./,            // CSS selectors
];

// Check if a class should be prefixed
function shouldPrefix(className) {
  // Skip if already prefixed
  if (className.startsWith(PREFIX)) return false;
  
  // Skip if matches skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(className)) return false;
  }
  
  // Check if it's a Tailwind class
  for (const prefix of TAILWIND_PREFIXES) {
    if (className === prefix.replace(/-$/, '') || className.startsWith(prefix)) {
      return true;
    }
  }
  
  // Handle negative values like -mt-4, -translate-x-1
  if (className.startsWith('-')) {
    const withoutNegative = className.slice(1);
    for (const prefix of TAILWIND_PREFIXES) {
      if (withoutNegative === prefix.replace(/-$/, '') || withoutNegative.startsWith(prefix)) {
        return true;
      }
    }
  }
  
  // Handle arbitrary values like w-[100px], bg-[#fff]
  if (className.includes('[') && className.includes(']')) {
    const baseClass = className.split('[')[0];
    for (const prefix of TAILWIND_PREFIXES) {
      if (baseClass === prefix.replace(/-$/, '') || baseClass.startsWith(prefix)) {
        return true;
      }
    }
  }
  
  return false;
}

// Prefix a single class
function prefixClass(className) {
  if (!shouldPrefix(className)) return className;
  
  // Handle responsive/state prefixes like "sm:flex" -> "sm:ap-flex"
  const colonIndex = className.lastIndexOf(':');
  if (colonIndex !== -1) {
    const statePrefix = className.slice(0, colonIndex + 1);
    const utility = className.slice(colonIndex + 1);
    
    // Handle negative values after state prefix
    if (utility.startsWith('-')) {
      return statePrefix + '-' + PREFIX + utility.slice(1);
    }
    return statePrefix + PREFIX + utility;
  }
  
  // Handle negative values like "-mt-4" -> "-ap-mt-4"
  if (className.startsWith('-')) {
    return '-' + PREFIX + className.slice(1);
  }
  
  return PREFIX + className;
}

// Process a className string (space-separated classes)
function processClassString(classString) {
  if (!classString || typeof classString !== 'string') return classString;
  
  return classString
    .split(/\s+/)
    .map(cls => prefixClass(cls.trim()))
    .join(' ');
}

// Process a file's content
function processFile(content) {
  let modified = content;
  
  // Pattern 1: className="..." (static strings)
  modified = modified.replace(
    /className="([^"]*)"/g,
    (match, classes) => `className="${processClassString(classes)}"`
  );
  
  // Pattern 2: className='...' (single quotes)
  modified = modified.replace(
    /className='([^']*)'/g,
    (match, classes) => `className='${processClassString(classes)}'`
  );
  
  // Pattern 3: className={`...`} (template literals - simple cases)
  // This is trickier - we need to preserve ${} expressions
  modified = modified.replace(
    /className=\{`([^`]*)`\}/g,
    (match, template) => {
      // Split by ${...} expressions and process only the static parts
      const parts = template.split(/(\$\{[^}]+\})/);
      const processed = parts.map((part, i) => {
        // Even indices are static strings, odd are ${} expressions
        if (i % 2 === 0) {
          return processClassString(part);
        }
        // For ${} expressions, try to process string literals inside
        return part.replace(/'([^']+)'/g, (m, classes) => `'${processClassString(classes)}'`)
                   .replace(/"([^"]+)"/g, (m, classes) => `"${processClassString(classes)}"`);
      });
      return `className={\`${processed.join('')}\`}`;
    }
  );
  
  // Pattern 4: Ternary expressions in className - 'class1' : 'class2'
  // Handle: condition ? 'flex' : 'hidden'
  modified = modified.replace(
    /\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
    (match, trueClass, falseClass) => `? '${processClassString(trueClass)}' : '${processClassString(falseClass)}'`
  );
  modified = modified.replace(
    /\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g,
    (match, trueClass, falseClass) => `? "${processClassString(trueClass)}" : "${processClassString(falseClass)}"`
  );
  
  // Pattern 5: Array of classes like ['flex', 'p-4']
  modified = modified.replace(
    /\['([^']+)'(?:,\s*'([^']+)')*\]/g,
    (match) => {
      return match.replace(/'([^']+)'/g, (m, cls) => `'${processClassString(cls)}'`);
    }
  );
  
  return modified;
}

// Main execution
async function main() {
  const srcDir = path.join(__dirname, '..', 'src');
  
  // Find all TSX and TS files
  const files = glob.sync('**/*.{tsx,ts,jsx,js}', { cwd: srcDir, absolute: true });
  
  console.log(`Found ${files.length} files to process...`);
  
  let totalChanges = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const processed = processFile(content);
    
    if (content !== processed) {
      fs.writeFileSync(file, processed, 'utf8');
      console.log(`✓ Updated: ${path.relative(srcDir, file)}`);
      totalChanges++;
    }
  }
  
  // Also process index.css if it has Tailwind @apply directives
  const cssFile = path.join(srcDir, 'index.css');
  if (fs.existsSync(cssFile)) {
    let cssContent = fs.readFileSync(cssFile, 'utf8');
    // Process @apply directives
    cssContent = cssContent.replace(
      /@apply\s+([^;]+);/g,
      (match, classes) => `@apply ${processClassString(classes)};`
    );
    fs.writeFileSync(cssFile, cssContent, 'utf8');
    console.log('✓ Updated: index.css');
    totalChanges++;
  }
  
  console.log(`\nDone! Modified ${totalChanges} files.`);
  console.log('\nNext steps:');
  console.log('1. Run "npm run build" to verify no errors');
  console.log('2. Test the app thoroughly');
  console.log('3. If issues found, check for missed patterns or custom classes');
}

main().catch(console.error);
