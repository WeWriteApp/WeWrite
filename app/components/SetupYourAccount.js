import { Icon } from "@iconify/react";
export default function SetupYourAccount() {
    return (
        <div className="bg-background border border-gray-300 p-5 shadow-md">
            <h2 className="text-lg font-semibold mb-2 text-text">Setup Your Account</h2>
            <div className="flex items-center justify-center">
                <Icon
                    icon="eos-icons:three-dots-loading"
                    className="text-text text-7xl"
                />
            </div>
        </div>
    );
}
