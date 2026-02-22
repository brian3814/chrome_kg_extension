export function extractPageContent(): { title: string; text: string; url: string } {
  const title = document.title || '';
  const url = window.location.href;

  // Try Readability-style extraction (simplified, since we can't import in content script)
  let text = '';

  // Try to get the main content
  const article =
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main') ||
    document.querySelector('.post-content') ||
    document.querySelector('.article-content') ||
    document.querySelector('.entry-content');

  if (article) {
    text = article.innerText;
  } else {
    // Fallback: get body text, excluding scripts, styles, nav, footer
    const body = document.body.cloneNode(true) as HTMLElement;
    const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'];
    removeSelectors.forEach((sel) => {
      body.querySelectorAll(sel).forEach((el) => el.remove());
    });
    text = body.innerText;
  }

  // Trim and limit length
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 10000) {
    text = text.substring(0, 10000) + '...';
  }

  return { title, text, url };
}

export function getSelectedText(): string {
  return window.getSelection()?.toString()?.trim() ?? '';
}
