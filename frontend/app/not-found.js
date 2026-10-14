import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page container">
      <div className="sheet empty">
        <h1 style={{ marginBottom: 8 }}>Page not found</h1>
        <p>The page you were looking for doesn&apos;t exist or was moved.</p>
        <Link className="btn" href="/">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
