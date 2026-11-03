'use client';
export default function PublicError({reset}: {error: Error; reset: () => void}) {
  return <div className="container page-state" role="alert"><p className="eyebrow">Something went wrong</p><h1>We couldn’t load this page.</h1><p>Please try again or return to the homepage.</p><button className="button button--primary" onClick={() => reset()}>Try again</button></div>;
}
