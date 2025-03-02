"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useConnect } from "../../providers/ConnectProvider";

export default function ConnectAccountSetup() {
  const { user, loading: userLoading } = useAuth();
  const {
    accountId,
    verificationStatus,
    noStripeAccount,
    loading,
    createConnectAccount,
    uploadIdentityDocument,
  } = useConnect();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: {
      day: "",
      month: "",
      year: "",
    },
    ssn: "", // Added SSN field
    address: { line1: "", city: "", state: "", postal_code: "", country: "US" },
    identityDocument: null,
    external_account: {
      routing_number: "",
      account_number: "",
    }
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userLoading) return;
  }, [userLoading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("address.")) {
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [name.split(".")[1]]: value },
      }));
    } else if (name.startsWith("dob.")) {
      setFormData((prev) => ({
        ...prev,
        dob: { ...prev.dob, [name.split(".")[1]]: value },
      }));
    } else if (name.startsWith("external_account.")) {
      setFormData((prev) => ({
        ...prev,
        external_account: { ...prev.external_account, [name.split(".")[1]]: value },
      }));
    }
    else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = (e) => {
    setFormData((prev) => ({ ...prev, identityDocument: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();    
    setError(null);

    // add uid to formData
    setFormData((prev) => ({ ...prev, uid: user.uid }));
    try {
      const account = await createConnectAccount(formData);
      
      // if (formData.identityDocument) {
      //   await uploadIdentityDocument(formData.identityDocument, account.accountId);
      // }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <p className="text-center text-gray-500">Checking verification status...</p>;
  }

  if (verificationStatus === "active") {
    return <p className="text-green-600 text-center">Your account is verified. No further action needed.</p>;
  }

  if (verificationStatus === "needs_onboarding") {
    return <p className="text-yellow-600 text-center">Your account is pending verification. Please complete the onboarding process.</p>;
  }

  if (noStripeAccount) {
    return <p className="text-yellow-600 text-center">No Stripe account found. Please create one.</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Setup Your Stripe Connect Account</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="tel" name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded" required />
        <div className="flex space-x-2">
          <input type="number" name="dob.month" placeholder="MM" onChange={handleChange} className="w-1/3 p-2 border rounded" required />
          <input type="number" name="dob.day" placeholder="DD" onChange={handleChange} className="w-1/3 p-2 border rounded" required />
          <input type="number" name="dob.year" placeholder="YYYY" onChange={handleChange} className="w-1/3 p-2 border rounded" required />
        </div>
        <input type="text" name="ssn" placeholder="Last 4 digits of SSN" value={formData.ssn} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="text" name="address.line1" placeholder="Street Address" value={formData.address.line1} onChange={handleChange} className="w-full p-2 border rounded" required />
        <div className="flex space-x-2">
          <input type="text" name="address.city" placeholder="City" value={formData.address.city} onChange={handleChange} className="w-1/3 p-2 border rounded" required />
          <input type="text" name="address.state" placeholder="State" value={formData.address.state} onChange={handleChange} className="w-1/3 p-2 border rounded" required />
          <input type="text" name="address.postal_code" placeholder="ZIP" value={formData.address.postal_code} onChange={handleChange} className="w-1/3 p-2 border rounded" required />
        </div>
        {/* external account */}
        <input type="text" name="external_account.routing_number" placeholder="Routing Number" value={formData.external_account.routing_number} onChange={handleChange} className="w-full p-2 border rounded" required />
        <input type="text" name="external_account.account_number" placeholder="Account Number" value={formData.external_account.account_number} onChange={handleChange} className="w-full p-2 border rounded" required />
        {/* <input type="file" onChange={handleFileUpload} className="w-full p-2 border rounded" /> */}
        <button type="submit" className="w-full p-3 bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? "Processing..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}
