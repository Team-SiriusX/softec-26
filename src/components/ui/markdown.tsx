'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'space-y-2 text-sm leading-relaxed',
        '[&_h1]:text-base [&_h1]:font-semibold',
        '[&_h2]:text-sm [&_h2]:font-semibold',
        '[&_h3]:text-sm [&_h3]:font-semibold',
        '[&_p]:whitespace-pre-wrap',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
        '[&_li]:leading-relaxed',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2',
        '[&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target='_blank' rel='noreferrer' />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
