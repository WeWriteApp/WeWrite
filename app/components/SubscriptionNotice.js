"use client";

const SubscriptionNotice = () => {
  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-gray-800 text-center flex flex-col items-center shadow-sm">
      {/* Warning Icon */}
      <div className="text-yellow-500 text-2xl mb-2">⚠</div>

      {/* Subscription Message */}
      <p className="text-gray-700 text-sm mb-3">
        To start supporting writers, you must activate your subscription.
      </p>

      {/* Activate Button */}
      <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg transition">
        Activate
      </button>
    </div>
  );
};

export default SubscriptionNotice;