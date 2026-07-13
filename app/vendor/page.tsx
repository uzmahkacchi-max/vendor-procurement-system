"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RFQ = {
  id: string;
  material: string;
  quantity: number;
  max_price: number;
  status: string;
  ends_at: string;
};

type Bid = {
  rfq_id: string;
  vendor_name: string;
  bid_price: number;
};

export default function VendorDashboard() {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [bidPrices, setBidPrices] = useState<Record<string, string>>({});
  const [bidsByRfq, setBidsByRfq] = useState<Record<string, Bid[]>>({});
  const [myVendorByRfq, setMyVendorByRfq] = useState<Record<string, string>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchRFQs();
    fetchBids();

    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    const channel = supabase
      .channel("bids-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids" },
        () => {
          fetchBids();
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchRFQs() {
    const { data, error } = await supabase
      .from("rfqs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setRfqs(data || []);
  }

  async function fetchBids() {
    const { data, error } = await supabase
      .from("bids")
      .select("rfq_id, vendor_name, bid_price");

    if (error) {
      alert(error.message);
      return;
    }

    const grouped: Record<string, Bid[]> = {};
    (data || []).forEach((bid: Bid) => {
      if (!grouped[bid.rfq_id]) grouped[bid.rfq_id] = [];
      grouped[bid.rfq_id].push(bid);
    });

    setBidsByRfq(grouped);
  }

  function getTimeRemaining(endTime: string) {
    const diff =
      new Date(endTime).getTime() - new Date().getTime();

    if (diff <= 0) return "Auction Closed";

    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `${minutes}m ${seconds}s`;
  }

  function getMyRank(rfqId: string) {
    const vendorName = myVendorByRfq[rfqId];
    if (!vendorName) return null;

    const bids = bidsByRfq[rfqId] || [];
    if (bids.length === 0) return null;

    const myBids = bids.filter((b) => b.vendor_name === vendorName);
    if (myBids.length === 0) return null;

    const myBestPrice = Math.min(...myBids.map((b) => b.bid_price));

    const sorted = [...bids].sort((a, b) => a.bid_price - b.bid_price);
    const rank =
      sorted.findIndex((b) => b.bid_price === myBestPrice) + 1;

    return { rank, total: bids.length };
  }

  async function submitBid(rfqId: string, endTime: string) {
    if (new Date(endTime) < new Date()) {
      alert("Auction has already ended.");
      return;
    }

    const vendorName = vendorNames[rfqId];
    const bidPrice = bidPrices[rfqId];
    const rfq = rfqs.find((r) => r.id === rfqId);

    if (!rfq) {
    alert("RFQ not found.");
    return;
    }

    if (Number(bidPrice) > rfq.max_price) {
    alert(
        `Your bid cannot be greater than the buyer's maximum price (₹${rfq.max_price}).`
    );
    return;
    }

    if (!vendorName || !bidPrice) {
      alert("Please enter vendor name and bid.");
      return;
    }

    const { error } = await supabase.from("bids").insert({
      rfq_id: rfqId,
      vendor_name: vendorName,
      bid_price: Number(bidPrice),
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("✅ Bid Submitted!");

    setMyVendorByRfq((prev) => ({ ...prev, [rfqId]: vendorName }));

    setVendorNames((prev) => ({ ...prev, [rfqId]: "" }));
    setBidPrices((prev) => ({ ...prev, [rfqId]: "" }));

    fetchBids();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-10">

      <div className="max-w-5xl mx-auto">

        <h1 className="text-4xl font-bold text-green-700 mb-2">
          Vendor Dashboard
        </h1>

        <p className="text-gray-600 mb-8">
          Submit quotations for active procurement requests.
        </p>

        {rfqs.map((rfq) => {

          const closed =
            new Date(rfq.ends_at) < new Date();

          const myRank = getMyRank(rfq.id);

          return (

            <div
              key={rfq.id}
              className="bg-white rounded-xl shadow-lg p-6 mb-6"
            >

              <h2 className="text-2xl font-bold">
                {rfq.material}
              </h2>

              <p className="mt-2">
                Quantity: {rfq.quantity}
              </p>

              <p>
                Maximum Price: ₹{rfq.max_price}
              </p>

              <p className="mt-2">
                Status:{" "}
                {closed ? "🔴 Closed" : "🟢 Live"}
              </p>

              <p className="font-semibold">
                Time Remaining:
                {" "}
                {getTimeRemaining(rfq.ends_at)}
              </p>

              <input
                className="border rounded-lg w-full p-3 mt-5"
                placeholder="Vendor Name"
                value={vendorNames[rfq.id] || ""}
                onChange={(e) =>
                  setVendorNames((prev) => ({
                    ...prev,
                    [rfq.id]: e.target.value,
                  }))
                }
                disabled={closed}
              />

              <input
                type="number"
                className="border rounded-lg w-full p-3 mt-3"
                placeholder="Bid Price"
                value={bidPrices[rfq.id] || ""}
                onChange={(e) =>
                  setBidPrices((prev) => ({
                    ...prev,
                    [rfq.id]: e.target.value,
                  }))
                }
                disabled={closed}
              />

              <button
                disabled={closed}
                onClick={() =>
                  submitBid(rfq.id, rfq.ends_at)
                }
                className={`mt-5 w-full py-3 rounded-lg text-white ${
                  closed
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {closed
                  ? "Auction Closed"
                  : "Submit Bid"}
              </button>

              {myRank && (
                <p className="mt-3 text-center font-semibold text-green-700">
                  Your current rank: #{myRank.rank} of {myRank.total}
                </p>
              )}

            </div>

          );

        })}

      </div>

    </main>
  );
}