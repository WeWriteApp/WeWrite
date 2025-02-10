import Link from "next/link";

export default function SetupYourAccount() {
    return (
        <div className="mx-auto max-w-4xl py-6">
            <div className="bg-background border border-gray-300 rounded-lg p-5 shadow-md">
                {/* Title */}
                <h2 className="text-lg font-semibold mb-3 text-text flex items-center">
                    <span className="mr-2">
                        <input type="radio" disabled className="w-5 h-5 text-blue-500" />
                    </span>
                    Set up your account
                </h2>

                {/* Steps */}
                <ul className="space-y-2">
                    <li className="flex items-center">
                        <input type="radio" disabled className="w-5 h-5 text-text mr-2" />
                        <Link href="/new-page" className="text-text hover:underline">
                            Create first page
                        </Link>
                    </li>
                    <li className="flex items-center">
                        <input type="radio" disabled className="w-5 h-5 text-text mr-2" />
                        <Link href="/settings/subscription" className="text-text hover:underline">
                            Activate subscription
                        </Link>
                    </li>
                    <li className="flex items-center">
                        <input type="radio" disabled className="w-5 h-5 text-text mr-2" />
                        <Link href="/settings/payouts" className="text-text hover:underline">
                            Set up payouts
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    );
}