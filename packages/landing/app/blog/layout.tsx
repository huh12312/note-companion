import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { getGitHubStars } from '@/lib/github';

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const starCount = await getGitHubStars();

  return (
    <div className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <div className="w-full border-b border-gray-700 bg-background backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2 text-2xl"
              >
                <Image
                  src="/notecompanion.png"
                  alt="note companion Logo"
                  width={30}
                  height={30}
                />
              </Link>
              <div className="flex items-center space-x-4">
                <a
                  href="https://www.youtube.com/watch?v=NQjZcL4sThs&list=PLgRcC-DFR5jdUxbSBuNeymwYTH_FSVxio"
                  className="text-sm text-gray-900 font-semibold"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  tutorials
                </a>

                <Link
                  href="/blog"
                  className="text-sm text-gray-900 font-semibold"
                >
                  blog
                </Link>

                <a
                  href="https://github.com/Nexus-JPF/note-companion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-[#1F2937] text-white px-3 py-1.5 rounded-full text-sm font-semibold"
                >
                  <Star className="h-4 w-4" />
                  <span>{starCount}</span>
                </a>
                <Link href="https://accounts.notecompanion.ai/sign-up">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    Start
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col w-full">{children}</div>
      </div>
    </div>
  );
}
