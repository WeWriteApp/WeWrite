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
    dob: { day: "", month: "", year: "" },
    ssn: "",
    address: { line1: "", city: "", state: "", postal_code: "", country: "US" },
    identityDocument: null,
    external_account: { routing_number: "", account_number: "" },
  });

  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userLoading) return;
  }, [userLoading]);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^\d{10}$/.test(phone.replace(/\D/g, ""));
  const validateDOB = (month, day, year) => {
    if (!month || !day || !year) return false;
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() == year &&
      date.getMonth() == month - 1 &&
      date.getDate() == day
    );
  };
  const validateSSN = (ssn) => /^\d{4}$/.test(ssn);
  const validateZip = (zip) => /^\d{5}(-\d{4})?$/.test(zip);
  const validateRoutingNumber = (routing) => /^\d{9}$/.test(routing);
  const validateAccountNumber = (account) => /^\d{6,17}$/.test(account);

  const validateForm = () => {
    let newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!validateEmail(formData.email)) newErrors.email = "Invalid email format";
    if (!validatePhone(formData.phone)) newErrors.phone = "Phone must be 10 digits";
    if (!validateDOB(formData.dob.month, formData.dob.day, formData.dob.year))
      newErrors.dob = "Invalid date of birth";
    if (!validateSSN(formData.ssn)) newErrors.ssn = "SSN must be last 4 digits";
    if (!formData.address.line1.trim()) newErrors.addressLine1 = "Address is required";
    if (!formData.address.city.trim()) newErrors.city = "City is required";
    if (!formData.address.state.trim() || formData.address.state.length !== 2)
      newErrors.state = "State must be 2 letters (e.g., TX)";
    if (!validateZip(formData.address.postal_code)) newErrors.zip = "Invalid ZIP code";
    if (!validateRoutingNumber(formData.external_account.routing_number))
      newErrors.routing = "Routing number must be 9 digits";
    if (!validateAccountNumber(formData.external_account.account_number))
      newErrors.account = "Account number must be between 6-17 digits";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const keys = name.split(".");
      if (keys.length > 1) {
        return {
          ...prev,
          [keys[0]]: {
            ...prev[keys[0]],
            [keys[1]]: value,
          },
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleFileUpload = (e) => {
    setFormData((prev) => ({ ...prev, identityDocument: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setFormData((prev) => ({ ...prev, uid: user.uid }));

    try {
      const account = await createConnectAccount(formData);
      if (formData.identityDocument) {
        await uploadIdentityDocument(formData.identityDocument, account.accountId);
      }
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
        {[
          { name: "firstName", placeholder: "First Name" },
          { name: "lastName", placeholder: "Last Name" },
          { name: "email", placeholder: "Email", type: "email" },
          { name: "phone", placeholder: "Phone (10 digits)", type: "tel" },
          { name: "ssn", placeholder: "Last 4 of SSN" },
          { name: "address.line1", placeholder: "Street Address" },
          { name: "external_account.routing_number", placeholder: "Routing Number" },
          { name: "external_account.account_number", placeholder: "Account Number" },
        ].map(({ name, placeholder, type = "text" }) => (
          <div key={name}>
            <input
              type={type}
              name={name}
              placeholder={placeholder}
              value={name.includes(".") ? formData[name.split(".")[0]][name.split(".")[1]] : formData[name]}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
            {errors[name] && <p className="text-red-500">{errors[name]}</p>}
          </div>
        ))}

        <div className="flex space-x-2">
          {["month", "day", "year"].map((part) => (
            <div key={part}>
              <input
                type="number"
                name={`dob.${part}`}
                placeholder={part.toUpperCase()}
                value={formData.dob[part]}
                onChange={handleChange}
                className="w-1/3 p-2 border rounded"
                required
              />
            </div>
          ))}
          {errors.dob && <p className="text-red-500">{errors.dob}</p>}
        </div>

        <input type="file" onChange={handleFileUpload} className="w-full p-2 border rounded" />

        <button type="submit" className="w-full p-3 bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? "Processing..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}