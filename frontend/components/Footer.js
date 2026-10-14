import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <span>Your resume is used only to score it against the job you choose.</span>
        <Link href="/privacy">How your data is used</Link>
      </div>
    </footer>
  );
}
