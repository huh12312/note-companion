import { BlogPost } from "@/types/blog";

interface BlogContentProps {
  post: BlogPost;
}

export function BlogContent({ post }: BlogContentProps) {
  return (
    <article className="max-w-4xl mx-auto">
      <div
        dangerouslySetInnerHTML={{ __html: post.htmlContent }}
        className="prose prose-lg max-w-none dark:prose-invert
          prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight
          prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4 prose-h1:font-bold prose-h1:text-gray-900
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:font-bold prose-h2:pt-2 prose-h2:text-gray-900
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-h3:font-semibold prose-h3:text-gray-800
          prose-p:text-gray-700 prose-p:leading-7 prose-p:mb-6 prose-p:text-base
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-a:font-medium
          prose-strong:text-gray-900 prose-strong:font-semibold
          prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
          prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto
          prose-blockquote:border-l-4 prose-blockquote:border-l-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:my-6
          prose-ul:list-disc prose-ul:pl-6 prose-ul:my-6 prose-ul:space-y-2
          prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-6 prose-ol:space-y-2
          prose-li:text-gray-700 prose-li:leading-7 prose-li:pl-2
          prose-img:rounded-lg prose-img:my-8 prose-img:w-full prose-img:h-auto prose-img:shadow-md
          prose-hr:my-8 prose-hr:border-border
          prose-table:w-full prose-table:my-6
          prose-th:border prose-th:border-border prose-th:px-4 prose-th:py-2 prose-th:bg-muted prose-th:text-gray-900
          prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2 prose-td:text-gray-700"
      />
    </article>
  );
}

