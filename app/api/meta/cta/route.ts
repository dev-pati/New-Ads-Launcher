import { NextResponse } from "next/server"

// Official Facebook Marketing API call_to_action_type enum values
// Source: https://developers.facebook.com/docs/marketing-api/reference/ad-creative/call-to-action/
const META_CTA_LIST = [
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "BOOK_TRAVEL", label: "Book Travel" },
  { value: "BUY_NOW", label: "Buy Now" },
  { value: "BUY_TICKETS", label: "Buy Tickets" },
  { value: "CALL_NOW", label: "Call Now" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "DONATE_NOW", label: "Donate Now" },
  { value: "DOWNLOAD", label: "Download" },
  { value: "GET_DIRECTIONS", label: "Get Directions" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "GET_SHOWTIMES", label: "Get Showtimes" },
  { value: "INSTALL_APP", label: "Install App" },
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "LISTEN_NOW", label: "Listen Now" },
  { value: "MESSAGE_PAGE", label: "Message Page" },
  { value: "NO_BUTTON", label: "No Button" },
  { value: "OPEN_LINK", label: "Open Link" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "PLAY_GAME", label: "Play Game" },
  { value: "REQUEST_TIME", label: "Request Time" },
  { value: "SAVE", label: "Save" },
  { value: "SEE_DETAILS", label: "See Details" },
  { value: "SEE_MENU", label: "See Menu" },
  { value: "SEND_MESSAGE", label: "Send Message" },
  { value: "SEND_WHATSAPP_MESSAGE", label: "Send WhatsApp Message" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "SUBSCRIBE", label: "Subscribe" },
  { value: "USE_APP", label: "Use App" },
  { value: "WATCH_MORE", label: "Watch More" },
  { value: "WHATSAPP_MESSAGE", label: "WhatsApp Message" },
]

export async function GET() {
  return NextResponse.json({ cta_options: META_CTA_LIST })
}
