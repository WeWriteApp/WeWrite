"use client";
import DashboardLayout from "../DashboardLayout";
import Link from "next/link";
import { Icon } from "@iconify/react/dist/iconify.js";

export default function SettingsLayout({ children }) {
    const navItems = [
        {
            name: "Subscription",
            href: "/settings/subscription",
            icon: "carbon:settings",
        },
        {
            name: "Payouts",
            href: "/settings/billing",
            icon: "carbon:credit-card",
        },
        {
            name: "Pledges to pages",
            href: "/settings/pledges",
            icon: "carbon:user-avatar",
        },
    ];

    return (
        <DashboardLayout>
            <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
                {/* Secondary Sidebar */}
                <div className="w-[300px] h-full sticky top-0 flex flex-col space-y-6 bg-background p-6 border-r border-gray-200">
                    <div className="flex flex-col space-y-1">
                        {navItems.map((item, index) => (
                            <Link key={index} href={item.href} className="flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-gray-100 hover:border hover:border-blue-500 hover:text-gray-900">
                                <Icon icon={item.icon} className="text-gray-600 text-lg mr-3" />
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Page Content */}
                <div className="flex-1 bg-background p-6 rounded-lg shadow-sm">
                    {children}
                </div>
            </div>
        </DashboardLayout>
    );
}