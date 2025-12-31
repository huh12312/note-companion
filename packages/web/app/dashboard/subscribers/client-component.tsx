'use client';

import { LicenseForm } from '@/app/components/license-form';
import { Button } from '@/components/ui/button';
import { CheckCircleIcon, DownloadIcon } from 'lucide-react';

export function SubscribersDashboardClient() {
  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <header>
          <div className="flex items-center">
            <DownloadIcon className="h-6 w-6 mr-2 text-blue-600" />
            <h1 className="text-2xl font-bold">Note Companion</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Organize and manage your notes with powerful tools
          </p>
        </header>

        <div className="flex flex-wrap gap-4 bg-slate-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-2 rounded-full">
              <CheckCircleIcon className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Organize</p>
              <p className="text-xs text-muted-foreground">Smart sorting</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-2 rounded-full">
              <DownloadIcon className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Easy Setup</p>
              <p className="text-xs text-muted-foreground">Quick install</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-full">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Productivity</p>
              <p className="text-xs text-muted-foreground">Custom workflows</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Tutorial Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-800">
              How to Use Note Companion
            </h2>
            <p className="text-muted-foreground">
              Watch our comprehensive tutorial video
            </p>
          </div>

          <div className="aspect-video mb-6 rounded-lg overflow-hidden shadow-md">
            <iframe
              src="https://www.youtube.com/embed/XZTpbECqZps"
              title="Note Companion Tutorial"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>

          <div className="space-y-4">
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
              <p className="text-slate-700">
                Learn how to organize your notes efficiently
              </p>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
              <p className="text-slate-700">
                Discover powerful automation features
              </p>
            </div>
            <div className="flex items-start">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
              <p className="text-slate-700">
                Set up custom workflows for productivity
              </p>
            </div>
          </div>
        </div>

        {/* License Card */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-800">
              Activate Your License
            </h2>
            <p className="text-muted-foreground">
              Enter your license key to unlock all features
            </p>
          </div>

          <div className="mb-8">
            <LicenseForm />
          </div>

          <div className="relative flex py-5 items-center">
            <div className="flex-grow">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-slate-500">
                Get Started
              </span>
            </div>
          </div>

          <a
            href="obsidian://show-plugin?id=fileorganizer2000"
            className="block mb-4"
          >
            <Button
              className="w-full py-2 text-base font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              variant="default"
            >
              <DownloadIcon className="h-5 w-5 mr-2" />
              Install in Obsidian
            </Button>
          </a>
          <p className="text-sm text-slate-500 text-center">
            Requires Obsidian app. Available for all platforms.
          </p>
        </div>
      </div>

      {/* Additional Resources Section */}
      <div className="mt-12 bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Need Help?</h2>
        <p className="text-slate-600 mb-6">
          Join our Discord community for support and discussions
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://discord.gg/udQnCRFyus"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="default"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Join Discord
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
