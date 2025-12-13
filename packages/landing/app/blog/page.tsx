import { Metadata } from "next";
import { BlogListingClient } from "./blog-listing-client";
import { getAllPosts, getAllCategories } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Read the latest updates, tips, and insights about Note Companion",
};

export default function BlogPage() {
  const allPosts = getAllPosts();
  const allCategories = getAllCategories();

  return <BlogListingClient initialPosts={allPosts} categories={allCategories} />;
}

