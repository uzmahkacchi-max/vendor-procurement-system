"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface RFQ {
  id: string;
  material: string;
  quantity: number;
  max_price: number;
  status: string;
  ends_at: string;
  created_at: string;
}

interface Bid {
  id: string;
  rfq_id: string;
  vendor_name: string;
  bid_price: number;
}

// Single source of truth for "is this auction still live".
// Everywhere in this file that needs to know active/closed status
// should call this instead of checking status or ends_at separately.
function isAuctionActive(rfq: RFQ): boolean {
  return (
    rfq.status === "active" &&
    new Date(rfq.ends_at).getTime() > Date.now()
  );
}

export default function Dashboard() {
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [loading, setLoading] = useState(false);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);

  const fetchRFQs = useCallback(async () => {
    const { data, error } = await supabase
      .from("rfqs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setRfqs(data || []);
  }, []);

 const fetchBids = useCallback(async () => {
  const { data, error } = await supabase
    .from("bids")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  setBids(data || []);
}, []);

  useEffect(() => {
    fetchRFQs();
    fetchBids();

    const rfqChannel = supabase
      .channel("dashboard-rfqs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rfqs" },
        () => fetchRFQs()
      )
      .subscribe();

    const bidChannel = supabase
      .channel("dashboard-bids")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids" },
        () => fetchBids()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rfqChannel);
      supabase.removeChannel(bidChannel);
    };
  }, [fetchRFQs, fetchBids]);

  async function createRFQ() {
    const trimmedMaterial = material.trim();
    const parsedQuantity = Number(quantity);
    const parsedMaxPrice = Number(maxPrice);

    if (!trimmedMaterial) {
      alert("Please enter a material name.");
      return;
    }
    if (!quantity || Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      alert("Quantity must be a positive number.");
      return;
    }
    if (!maxPrice || Number.isNaN(parsedMaxPrice) || parsedMaxPrice <= 0) {
      alert("Maximum price must be a positive number.");
      return;
    }

    setLoading(true);

    const endsAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

    const { error } = await supabase.from("rfqs").insert({
      material: trimmedMaterial,
      quantity: parsedQuantity,
      max_price: parsedMaxPrice,
      status: "active",
      ends_at: endsAt,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material: trimmedMaterial,
          quantity: parsedQuantity,
          max_price: parsedMaxPrice,
          ends_at: endsAt,
        }),
      });
    } catch (err) {
      console.error("Email notification failed:", err);
      // Non-fatal: RFQ was created successfully even if the email failed.
    }

    setLoading(false);
    alert("🎉 Reverse Auction Started!\n\nEmail notifications sent.");

    setMaterial("");
    setQuantity("");
    setMaxPrice("");

    // Realtime INSERT event should refresh state, but we also refetch directly
    // in case the realtime channel doesn't fire for any reason.
    fetchRFQs();
  }

  async function closeAuction(id: string) {
    // Manual close must behave exactly like a natural expiry: set status to
    // "closed" AND pull ends_at back to now, so isAuctionActive() (which
    // checks both fields) immediately reports false everywhere it's used.
    const { error } = await supabase
      .from("rfqs")
      .update({ status: "closed", ends_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "active");

    if (error) {
      alert(error.message);
    }

    // Don't rely solely on the realtime UPDATE event to refresh local state —
    // refetch directly so the dashboard reflects the change immediately even
    // if the realtime channel is delayed or misses the event.
    fetchRFQs();
  }

  async function deleteAuction(id: string) {
  if (!confirm("Delete this RFQ permanently? This cannot be undone.")) {
    return;
  }

  // Delete all bids for this RFQ first
  const { error: bidError } = await supabase
    .from("bids")
    .delete()
    .eq("rfq_id", id);

  if (bidError) {
    alert(bidError.message);
    return;
  }

  // Now delete the RFQ
  const { error: rfqError } = await supabase
    .from("rfqs")
    .delete()
    .eq("id", id);

  if (rfqError) {
    alert(rfqError.message);
    return;
  }

  fetchRFQs();
  fetchBids();
}
  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-blue-700">Buyer Dashboard</h1>

        <p className="text-gray-600 mb-8">
          Manage procurement requests and monitor live reverse auctions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Active Auctions</p>
            <h2 className="text-4xl font-bold text-green-600">
              {rfqs.filter(isAuctionActive).length}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Completed Auctions</p>
            <h2 className="text-4xl font-bold text-red-600">
              {rfqs.filter((r) => !isAuctionActive(r)).length}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Total RFQs</p>
            <h2 className="text-4xl font-bold text-blue-600">{rfqs.length}</h2>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">Total Bids</p>
            <h2 className="text-4xl font-bold text-purple-600">{bids.length}</h2>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-10">
          <h2 className="text-2xl font-semibold mb-6">Create Procurement Request</h2>

          <input
            className="border rounded-lg w-full p-3 mb-4"
            placeholder="Material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          />

          <input
            type="number"
            min="1"
            className="border rounded-lg w-full p-3 mb-4"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <input
            type="number"
            min="1"
            step="0.01"
            className="border rounded-lg w-full p-3 mb-6"
            placeholder="Maximum Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />

          <button
            onClick={createRFQ}
            disabled={loading}
            className="w-full bg-blue-600 disabled:opacity-60 text-white py-3 rounded-lg"
          >
            {loading ? "Starting..." : "🚀 Start Reverse Auction"}
          </button>
        </div>

        <h2 className="text-3xl font-bold mb-6">Live Auctions</h2>

        {rfqs.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-lg">No RFQs yet.</p>
            <p className="text-gray-400 mt-2">Create your first one above.</p>
          </div>
        ) : (
          rfqs.map((rfq) => {
            const auctionBids = bids
              .filter((bid) => bid.rfq_id === rfq.id)
              .sort((a, b) => a.bid_price - b.bid_price);

            const winner = auctionBids[0];

            return (
              <AuctionCard
                key={rfq.id}
                rfq={rfq}
                auctionBids={auctionBids}
                winner={winner}
                onAutoClose={() => closeAuction(rfq.id)}
                onManualClose={() => closeAuction(rfq.id)}
                onDelete={() => deleteAuction(rfq.id)}
              />
            );
          })
        )}
      </div>
    </main>
  );
}

interface AuctionCardProps {
  rfq: RFQ;
  auctionBids: Bid[];
  winner: Bid | undefined;
  onAutoClose: () => void;
  onManualClose: () => void;
  onDelete: () => void;
}

function AuctionCard({
  rfq,
  auctionBids,
  winner,
  onAutoClose,
  onManualClose,
  onDelete,
}: AuctionCardProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(rfq.ends_at).getTime() - Date.now())
  );

  useEffect(() => {
    // If the auction is already not active (closed manually, or ends_at is
    // already in the past), don't start a timer at all — just show 0 and stop.
    if (!isAuctionActive(rfq)) {
      setRemainingMs(0);
      return;
    }

    const target = new Date(rfq.ends_at).getTime();

    const tick = () => {
      const remaining = Math.max(0, target - Date.now());
      setRemainingMs(remaining);
      return remaining;
    };

    // Run an immediate check in case the auction already expired between
    // renders, so we don't wait a full second to notice.
    if (tick() === 0) {
      onAutoClose();
      return;
    }

    const interval = setInterval(() => {
      const remaining = tick();
      if (remaining === 0) {
        clearInterval(interval);
        onAutoClose();
      }
    }, 1000);

    // Clear the interval on unmount AND whenever rfq.status/ends_at change
    // (e.g. after a manual close updates the row), so no stale timer keeps
    // running in the background.
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfq.ends_at, rfq.status]);

  const isActive = isAuctionActive(rfq);
  const mins = Math.floor(remainingMs / 1000 / 60);
  const secs = Math.floor((remainingMs / 1000) % 60);
  const timeLabel = isActive ? `${mins}m ${secs}s` : "Auction Closed";

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold">{rfq.material}</h2>

      <p>Quantity: {rfq.quantity}</p>
      <p>Maximum Price: ₹{rfq.max_price}</p>
      <p className="text-gray-500 text-sm mt-1">RFQ ID: {rfq.id.slice(0, 8)}</p>

      <p className="mt-2">Status: {isActive ? "🟢 Live" : "🔴 Closed"}</p>

      <p className="font-semibold">Time Remaining: {timeLabel}</p>

      <div className="flex gap-3 mt-4">
        {isActive && (
          <button
            onClick={onManualClose}
            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2 rounded-lg"
          >
            Close Auction
          </button>
        )}
        <button
          onClick={onDelete}
          className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold py-2 rounded-lg"
        >
          Delete Auction
        </button>
      </div>

      {!isActive && winner && (
        <div className="mt-5 bg-green-100 rounded-lg p-4">
          <h3 className="font-bold text-xl">🏆 Winner</h3>
          <p>{winner.vendor_name}</p>
          <p>Winning Bid: ₹{winner.bid_price}</p>
        </div>
      )}

      <h3 className="text-xl font-semibold mt-6 mb-3">Vendor Bids</h3>

      {auctionBids.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-lg">No bids received yet.</p>
          <p className="text-gray-400 mt-2">
            Vendors will appear here after submitting quotations.
          </p>
        </div>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Rank</th>
              <th className="border p-2">Vendor</th>
              <th className="border p-2">Bid</th>
            </tr>
          </thead>
          <tbody>
            {auctionBids.map((bid, index) => {
              const isWinningRow = !isActive && index === 0;

              return (
                <tr key={bid.id} className={isWinningRow ? "bg-green-100 font-semibold" : ""}>
                  <td className="border p-2">#{index + 1}</td>
                  <td className="border p-2">
                    {bid.vendor_name}
                    {isWinningRow && (
                      <span className="ml-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                        Winner
                      </span>
                    )}
                  </td>
                  <td className={`border p-2 ${isWinningRow ? "text-green-700 font-bold" : ""}`}>
                    ₹{bid.bid_price}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}