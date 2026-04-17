import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

function PaymentCancel() {
  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-16">
      <XCircle className="mx-auto text-neutral-300" size={56} />
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">Payment cancelled</h1>
      <p className="text-neutral-400">
        No charge was made. You can try again whenever you&apos;re ready.
      </p>
      <Link
        to="/dashboard"
        className="btn-ui btn-secondary inline-block"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

export default PaymentCancel;
