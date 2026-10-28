import { lexer } from 'marked';
import type { Provider, Source } from '../services/api';

export interface ResultOrigin {
  kind: 'message' | 'module' | 'artifact' | 'github';
  title: string;
  content: string;
  context: string;
  projectId?: string;
  conversationId?: string;
  messageId?: string;
  artifactId?: string;
  provider?: Provider;
  model?: string;
  createdAt?: string;
  sources?: Source[];
  github?: { snapshotId: string; reportId: string; persistable: boolean };
  comparison?: { before: string; path: string; partial?: boolean; sha256?: string };
}

export function resultBlocks(content: string) {
  return lexer(content).flatMap(token => token.type === 'code'
    ? [{ language: (token.lang ?? 'text').split(/\s+/)[0]!.toLowerCase(), content: token.text }]
    : []);
}

export function comparisonPath(language: string) {
  const extension: Record<string, string> = { typescript: 'ts', javascript: 'js', ts: 'ts', js: 'js', python: 'py', vue: 'vue', html: 'html', sql: 'sql', json: 'json', yaml: 'yaml', java: 'java', go: 'go', rust: 'rs', css: 'css' };
  return `fragmento-propuesto.${extension[language] ?? 'txt'}`;
}
