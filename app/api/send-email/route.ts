import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { material, quantity, max_price, ends_at } = body;

    const data = await resend.emails.send({
      from: "Vendor Procurement <onboarding@resend.dev>",
      to: [
        "uzmahkacchi@gmail.com",
      ],
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
  console.error("Resend Error:", data.error);

  return NextResponse.json(
    { error: data.error.message },
    { status: data.error.statusCode || 500 }
  );
}

console.log("Resend Success:", data);
return NextResponse.json(data);



  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}