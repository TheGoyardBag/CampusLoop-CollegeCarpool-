'use client';
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <main className="auth-shell"><section className="panel"><h1>Something went wrong</h1><p>Your saved trips are not changed. Please try again.</p><button onClick={reset}>Try again</button></section></main>; }
