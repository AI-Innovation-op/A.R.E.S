import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(content, { async: false, breaks: true }), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'video', 'audio', 'iframe', 'style', 'form', 'input'],
    FORBID_ATTR: ['style'],
  });
}
