export interface BlogPostMetadata {
  title: string;
  slug: string;
  date: string;
  category: string;
  tags: string[];
  excerpt: string;
}

export interface BlogPost extends BlogPostMetadata {
  content: string;
  htmlContent: string;
}

