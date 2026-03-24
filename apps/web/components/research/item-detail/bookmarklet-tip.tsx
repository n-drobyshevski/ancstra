'use client';

import { useRef, useEffect } from 'react';
import { Bookmark } from 'lucide-react';

export function BookmarkletTip() {
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (bookmarkletRef.current) {
      const origin = window.location.origin;
      const code = [
        'var s="main,article,[role=main],#content,.content,#main-content,.main-content,[itemprop=mainEntity],[itemtype*=Person],[itemtype*=Article],.profile,.memorial,.biography,.record-detail"',
        'var e=document.querySelector(s)||document.body',
        'var c=e.cloneNode(true)',
        'var r="script,style,link,nav,footer,header,aside,iframe,noscript,form,button,input,select,textarea,label,svg,[role=navigation],[role=banner],[role=dialog],[role=alertdialog],[role=search],.nav,.footer,.header,.sidebar,.modal,.dialog,.login,.signup,.cookie,.banner,.toolbar,.menu,.dropdown,.ad,.advertisement,.social-share,.share,.popup,.overlay,.toast,#cookie-banner,.gdpr,.consent"',
        'r.split(",").forEach(function(s){c.querySelectorAll(s).forEach(function(n){n.remove()})})',
        'c.querySelectorAll("[style*=\\"display:none\\"],.hidden,.d-none,[aria-hidden=true]").forEach(function(n){n.remove()})',
        `var w=window.open("${origin}/research/bookmarklet-receiver","_blank")`,
        'var d={type:"ancstra-bookmarklet",html:c.innerHTML,url:location.href,title:document.title}',
        'setTimeout(function(){w.postMessage(d,"*")},2000)',
      ].join(';');
      bookmarkletRef.current.setAttribute(
        'href',
        `javascript:void(function(){${code}}())`,
      );
    }
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
      <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        Drag this to your bookmark bar:{' '}
        <a
          ref={bookmarkletRef}
          href="#"
          suppressHydrationWarning
          className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 font-medium text-primary ring-1 ring-border hover:ring-primary"
          onClick={(e) => {
            e.preventDefault();
            alert(
              'Drag this link to your bookmark bar. Then click it on any page to send its text to Ancstra.',
            );
          }}
        >
          Send to Ancstra
        </a>{' '}
        — then click it on any page to capture its text.
      </p>
    </div>
  );
}
