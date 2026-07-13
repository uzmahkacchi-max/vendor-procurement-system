import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { material, quantity, max_price, ends_at } = body;

    // Get all vendor email addresses
    const { data: vendors, error: vendorError } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "vendor");

    if (vendorError) {
      console.error(vendorError);

      return NextResponse.json(
        { error: vendorError.message },
        { status: 500 }
      );
    }

    const emails =
      vendors
        ?.map((vendor) => vendor.email)
        .filter(Boolean) || [];

    if (emails.length === 0) {
      return NextResponse.json({
        message: "No vendors found.",
      });
    }

    const data = await resend.emails.send({
      from: "Vendor Procurement <onboarding@resend.dev>",
      to: emails,
      subject: `New RFQ: ${material}`,
      html: `
        <h2>New Procurement Request</h2>

        <p><strong>Material:</strong> ${material}</p>

        <p><strong>Quantity:</strong> ${quantity}</p>

        <p><strong>Maximum Price:</strong> ₹${max_price}</p>

        <p><strong>Auction Ends:</strong> ${new Date(
          ends_at
        ).toLocaleString()}</p>

        <hr/>

        <p>Please log in to the Vendor Procurement System and submit your bid before the auction closes.</p>
      `,
    });

    if (data.error) {
      console.error(data.error);

      return NextResponse.json(
        { error: data.error.message },
        { status: data.error.statusCode || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipients: emails.length,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}