"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RankPage() {
  const [vendorName, setVendorName] = useState("");
  const [rank, setRank] = useState<number | null>(null);

  async function checkRank() {
    const { data, error } = await supabase
      .from("bids")
      .select("*")
      .order("bid_price", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const index = data.findIndex(
      (bid) =>
        bid.vendor_name.trim().toLowerCase() ===
        vendorName.trim().toLowerCase()
    );

    if (index === -1) {
      alert("No bid found for this vendor.");
      return;
    }

    setRank(index + 1);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6">
          Check Your Rank
        </h1>

        <input
          className="border rounded p-3 w-full"
          placeholder="Vendor Name"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        />

        <button
          onClick={checkRank}
          className="bg-blue-600 text-white w-full mt-4 py-3 rounded-lg"
        >
          Check Rank
        </button>

        {rank && (
          <h2 className="text-2xl mt-6 font-bold text-green-700">
            Your Rank: #{rank}
          </h2>
        )}
      </div>
    </main>
  );
}