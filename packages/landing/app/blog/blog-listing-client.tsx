"use client";

import { useState, useMemo } from "react";
import { BlogCard } from "./components/blog-card";
import { BlogSearch } from "./components/blog-search";
import { CategoryFilter } from "./components/category-filter";
import { BlogPost } from "@/types/blog";

interface BlogListingClientProps {
  initialPosts: BlogPost[];
  categories: string[];
}

export function BlogListingClient({
  initialPosts,
  categories,
}: BlogListingClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter posts based on search and category
  const filteredPosts = useMemo(() => {
    let filtered: BlogPost[] = initialPosts;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((post) => post.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.excerpt.toLowerCase().includes(query) ||
          post.content.toLowerCase().includes(query) ||
          post.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [initialPosts, selectedCategory, searchQuery]);

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Blog</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay updated with the latest features, tips, and insights about Note Companion
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          <BlogSearch onSearch={setSearchQuery} />
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {/* Results count */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery || selectedCategory
                ? "No posts found matching your criteria."
                : "No blog posts yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"} found
            </p>

            {/* Blog Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

