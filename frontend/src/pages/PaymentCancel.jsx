import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

function PaymentCancel() {
  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-16">
      <XCircle className="mx-auto text-amber-400" size={56} />
      <h1 className="text-2xl font-bold text-white">Payment cancelled</h1>
      <p className="text-gray-400">
        No charge was made. You can try again whenever you&apos;re ready.
      </p>
      <Link
        to="/dashboard"
        className="inline-block bg-gray-700 hover:bg-gray-600 text-white font-medium px-6 py-2 rounded-lg"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

export default PaymentCancel;
