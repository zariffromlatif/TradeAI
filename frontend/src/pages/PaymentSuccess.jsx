import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";

function PaymentSuccess() {
  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-16">
      <CheckCircle className="mx-auto text-[#8ab4ff]" size={56} />
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Payment successful</h1>
      <p className="text-neutral-400">
        Thank you. If checkout completed, your account may be upgraded to
        Premium after Stripe confirms the payment (webhook).
      </p>
      <Link
        to="/dashboard"
        className="btn-ui btn-primary inline-block"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

export default PaymentSuccess;
