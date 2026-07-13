import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-lg text-center max-w-xl">

        <h1 className="text-4xl font-bold text-blue-600">
          Vendor Procurement System
        </h1>

        <p className="mt-4 text-gray-600">
          Reverse Auction Platform for Procurement Management
        </p>

        <div className="mt-8">

          <Link
            href="/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 inline-block"
          >
            Get Started
          </Link>

        </div>

      </div>
    </main>
  );
}