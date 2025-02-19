"use client";
import { useState } from "react";
import { loginUser } from "../firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LoginForm = () => {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await loginUser(user.email, user.password);
    if (response.code) {
      setError(response.message);
    } else {
      router.push("/pages");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-4 bg-white/10 rounded-[20px] border border-white/20 flex-col justify-start items-center gap-6 inline-flex">
        <div className="self-stretch h-[60px] flex-col justify-start items-start gap-[7px] flex">
          <div className="self-stretch text-center text-[28px] font-medium font-['Inter']">Sign in</div>
          <div className="self-stretch text-center text-base font-normal font-['Inter']">WeWrite</div>
        </div>
        <div data-svg-wrapper>
        <svg width="470" height="1" viewBox="0 0 470 1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 0.5H469" stroke="white" strokeOpacity="0.15" strokeLinecap="round"/>
        </svg>
        </div>
        <div className="self-stretch flex-col justify-start items-start gap-3 flex">
          <div className="self-stretch h-[67px] flex-col justify-start items-start gap-4 flex">
            <div className="self-stretch h-[67px] flex-col justify-start items-start gap-1.5 flex">
              <div className="self-stretch px-4 justify-center items-center gap-1 inline-flex">
                <div data-svg-wrapper className="relative">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.60423 4.70606L8.00152 7.90471L14.3989 4.70602C14.3506 3.86574 13.6539 3.19922 12.8016 3.19922H3.20156C2.34918 3.19922 1.65247 3.86576 1.60423 4.70606Z" fill="white" fillOpacity="0.72"/>
                <path d="M14.4016 6.49354L8.00152 9.69356L1.60156 6.49358V11.1992C1.60156 12.0829 2.31791 12.7992 3.20156 12.7992H12.8016C13.6852 12.7992 14.4016 12.0829 14.4016 11.1992V6.49354Z" fill="white" fillOpacity="0.72"/>
                </svg>
                </div>
                <div className="grow shrink basis-0 text-base font-['SF Pro']">Email or username</div>
              </div>
              <input type="email" name="email" value={user.email} onChange={handleChange} className="self-stretch h-[42px] p-4 rounded-2xl border justify-start items-center gap-2.5 inline-flex text-base font-['SF Pro'] focus:bg-[#1768ff]/30 focus:shadow-[0px_0px_54px_0px_rgba(0,131,253,0.40)] focus:border-[#1768ff]" placeholder="Email or username">
              </input>
            </div>
          </div>
          <div className={`self-stretch flex-col justify-start items-start gap-4 inline-flex ${user.email == '' ? 'hidden' : ''}`}>
            <div className="self-stretch h-[67px] flex-col justify-start items-start gap-1.5 flex">
              <div className="self-stretch px-4 justify-center items-center gap-1 inline-flex">
                <div data-svg-wrapper className="relative">
                <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M3.99844 7.69961V6.09961C3.99844 3.89047 5.7893 2.09961 7.99844 2.09961C10.2076 2.09961 11.9984 3.89047 11.9984 6.09961V7.69961C12.8821 7.69961 13.5984 8.41595 13.5984 9.29961V13.2996C13.5984 14.1833 12.8821 14.8996 11.9984 14.8996H3.99844C3.11478 14.8996 2.39844 14.1833 2.39844 13.2996V9.29961C2.39844 8.41595 3.11478 7.69961 3.99844 7.69961ZM10.3984 6.09961V7.69961H5.59844V6.09961C5.59844 4.77413 6.67295 3.69961 7.99844 3.69961C9.32392 3.69961 10.3984 4.77413 10.3984 6.09961Z" fill="white"/>
                </svg>
                </div>
                <div className="grow shrink basis-0 text-white text-base font-['SF Pro']">Password</div>
              </div>
              <input type="password" name="password" value={user.password} onChange={handleChange} className="self-stretch h-[42px] px-[18px] py-4 focus:bg-[#1768ff]/30 rounded-2xl focus:shadow-[0px_0px_54px_0px_rgba(0,131,253,0.40)] border-2 focus:border-[#1768ff]">
              </input>
            </div>
          </div>
          <button className={`self-stretch h-[42px] px-4 py-2.5 rounded-2xl border justify-center items-center gap-1.5 inline-flex ${user.email == '' ? '' : 'hidden'}`}>
            <div data-svg-wrapper className="relative">
            <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 6.33333C13.9205 6.33333 14.6667 7.07953 14.6667 8M18 8C18 10.7614 15.7614 13 13 13C12.4949 13 12.0072 12.9251 11.5476 12.7858L9.66667 14.6667H8V16.3333H6.33333V18H3.83333C3.3731 18 3 17.6269 3 17.1667V15.0118C3 14.7908 3.0878 14.5789 3.24408 14.4226L8.21423 9.45244C8.07491 8.99279 8 8.50514 8 8C8 5.23858 10.2386 3 13 3C15.7614 3 18 5.23858 18 8Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            </div>
            <div className="text-lg font-semibold font-['Inter Variable']">Use passkey</div>
          </button>
        </div>
        <div data-svg-wrapper>
        <svg width="470" height="1" viewBox="0 0 470 1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 0.5H469" stroke="white" strokeOpacity="0.15" strokeLinecap="round"/>
        </svg>
        </div>
        <div className="self-stretch h-[75px] flex-col justify-start items-start gap-3 flex">
          <div className="self-stretch text-center text-[17px] font-normal font-['Inter']">No account?</div>
          <button onClick={() => router.push("/auth/register")} className="self-stretch h-[42px] px-4 py-2.5 rounded-2xl border justify-center items-center gap-1.5 inline-flex">
            <div className="text-lg font-semibold font-['Inter Variable']">Create account</div>
          </button>
        </div>
      </div>
    </form>
  );
};

export default LoginForm;