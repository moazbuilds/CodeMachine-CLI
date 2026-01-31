// CodeMachine AI Assistant - Syntax Highlighting with Prism.js

const PRISM_CSS_LIGHT = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
const PRISM_CSS_DARK = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
const PRISM_JS = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
const PRISM_AUTOLOADER = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js';

let prismLoaded = false;
let cssLink = null;

function isDarkMode() {
  return document.documentElement.classList.contains('dark') ||
         document.body.classList.contains('dark');
}

function loadCSS(href, id) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  return link;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function loadPrism() {
  if (prismLoaded) return;

  // Load theme based on current mode
  const cssUrl = isDarkMode() ? PRISM_CSS_DARK : PRISM_CSS_LIGHT;
  cssLink = loadCSS(cssUrl, 'prism-theme');

  // Load Prism core
  await loadScript(PRISM_JS);

  // Load autoloader for language support
  await loadScript(PRISM_AUTOLOADER);

  // Configure autoloader path
  if (window.Prism && window.Prism.plugins.autoloader) {
    window.Prism.plugins.autoloader.languages_path =
      'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/';
  }

  prismLoaded = true;

  // Watch for theme changes
  const observer = new MutationObserver(() => {
    const newCssUrl = isDarkMode() ? PRISM_CSS_DARK : PRISM_CSS_LIGHT;
    if (cssLink && cssLink.href !== newCssUrl) {
      cssLink.href = newCssUrl;
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

export async function highlightCode(container) {
  // Ensure Prism is loaded
  if (!window.Prism) {
    await loadPrism();
  }

  if (!window.Prism) return;

  const codeBlocks = container.querySelectorAll('pre.cm-code-block');

  codeBlocks.forEach(pre => {
    const lang = pre.dataset.lang || 'plaintext';
    const code = pre.querySelector('code');

    if (code) {
      // Remove old highlight class to force re-highlight
      code.classList.remove('prism-highlighted');

      // Add language class for Prism
      code.className = `language-${lang}`;
      pre.className = `cm-code-block language-${lang}`;

      // Highlight
      window.Prism.highlightElement(code);
      code.classList.add('prism-highlighted');
    }
  });
}
