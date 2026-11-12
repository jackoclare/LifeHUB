import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <p className="font-display text-4xl font-semibold">404</p>
      <p className="mt-2 text-sm text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
