import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";

function PaymentSuccess() {
  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-16">
      <CheckCircle className="mx-auto text-emerald-400" size={56} />
      <h1 className="text-2xl font-bold text-white">Payment successful</h1>
      <p className="text-gray-400">
        Thank you. If checkout completed, your account may be upgraded to
        Premium after Stripe confirms the payment (webhook).
      </p>
      <Link
        to="/dashboard"
        className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2 rounded-lg"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

export default PaymentSuccess;
