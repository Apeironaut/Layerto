import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * A small, safe Markdown renderer (no HTML is ever injected): headings, paragraphs, lists,
 * quotes, fenced code, inline code, bold, italics and http(s) links.
 */

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // order matters: code first so its contents aren't formatted
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    const tok = m[0];
    if (m[1]) {
      out.push(<code key={k} className="rounded bg-page border border-line px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    } else if (m[2]) {
      out.push(<strong key={k} className="font-semibold text-ink">{inline(tok.slice(2, -2), k)}</strong>);
    } else if (m[3]) {
      out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    } else if (m[4]) {
      const label = tok.slice(1, tok.indexOf(']'));
      const url = tok.slice(tok.indexOf('(') + 1, -1);
      out.push(
        SAFE_URL.test(url) ? (
          <a key={k} href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-crimson underline underline-offset-2">
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else if (m[5]) {
      out.push(
        <a key={k} href={tok} target="_blank" rel="noopener noreferrer nofollow" className="text-crimson underline underline-offset-2 break-all">
          {tok}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className, compact = false }: { text: string; className?: string; compact?: boolean }) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++} className="rounded-control bg-page border border-line p-3 overflow-x-auto font-mono text-xs leading-relaxed" tabIndex={0}>
          {code.join('\n')}
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const cls = h[1].length === 1 ? 'text-lg font-bold' : h[1].length === 2 ? 'text-base font-bold' : 'text-sm font-semibold';
      blocks.push(<p key={key++} className={cn(cls, 'text-ink mt-1')}>{inline(h[2], `h${key}`)}</p>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ''));
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={key++} className={cn('pl-5 space-y-0.5', ordered ? 'list-decimal' : 'list-disc')}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `l${key}-${j}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-crimson-border pl-3 text-muted italic">
          {inline(quote.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|```|>|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {inline(para.join('\n'), `p${key}`)}
      </p>,
    );
  }
  return <div className={cn('text-sm text-ink-secondary leading-relaxed break-words', compact ? 'space-y-1.5' : 'space-y-3', className)}>{blocks}</div>;
}
