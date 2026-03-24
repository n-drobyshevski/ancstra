'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function BookmarkletReceiverPage() {
  const [status, setStatus] = useState<'waiting' | 'saving' | 'done' | 'error'>('waiting');
  const [message, setMessage] = useState('Waiting for page content...');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only accept messages from the same window opener or any origin (bookmarklet runs on external sites)
      if (event.data?.type !== 'ancstra-bookmarklet') return;

      const { html, text, url, title } = event.data;
      if (!html && !text) {
        setStatus('error');
        setMessage('No content received.');
        return;
      }

      setStatus('saving');
      setMessage('Saving content...');

      // Build form data and POST to the API (same-origin, cookies included)
      const formData = new FormData();
      if (html) formData.append('html', html);
      if (text) formData.append('text', text);
      if (url) formData.append('url', url);
      if (title) formData.append('title', title);

      fetch('/api/research/bookmarklet', {
        method: 'POST',
        body: formData,
      })
        .then(async (res) => {
          const body = await res.text();
          // Extract redirect URL from the HTML response
          const match = body.match(/location\.href="([^"]+)"/);
          if (res.ok && match?.[1]) {
            setStatus('done');
            setMessage('Content saved!');
            setRedirectUrl(match[1]);
            setTimeout(() => {
              window.location.href = match[1];
            }, 1500);
          } else if (res.ok) {
            setStatus('done');
            setMessage('Content saved!');
          } else {
            setStatus('error');
            setMessage('Failed to save. Make sure you are logged in.');
          }
        })
        .catch(() => {
          setStatus('error');
          setMessage('Network error. Please try again.');
        });
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        {status === 'waiting' && (
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-muted-foreground" />
        )}
        {status === 'saving' && (
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
        )}
        {status === 'done' && (
          <CheckCircle2 className="mx-auto mb-3 size-8 text-green-500" />
        )}
        {status === 'error' && (
          <XCircle className="mx-auto mb-3 size-8 text-destructive" />
        )}
        <p className="text-lg font-medium">{message}</p>
        {redirectUrl && (
          <p className="mt-2 text-sm text-muted-foreground">
            Redirecting...{' '}
            <a href={redirectUrl} className="text-primary hover:underline">
              Click here
            </a>{' '}
            if not redirected.
          </p>
        )}
        {status === 'waiting' && (
          <p className="mt-2 text-sm text-muted-foreground">
            This page receives content from the Ancstra bookmarklet.
          </p>
        )}
      </div>
    </div>
  );
}
