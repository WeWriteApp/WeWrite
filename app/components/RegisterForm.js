"use client";
import { createUser, addUsername } from "../firebase/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const RegisterForm = () => {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });

  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await createUser(user.email, user.password);
    if (response.code) {
      setError(response.message);
    } else {
      await addUsername(user.username);
      router.push("/pages"); 
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="h-[478px] p-4 bg-white/10 rounded-[20px] border border-white/20 flex-col justify-start items-center gap-6 inline-flex">
        <div className="self-stretch h-[60px] flex-col justify-start items-start gap-[7px] flex">
          <div className="self-stretch text-center text-white text-[28px] font-medium font-['Inter']">Create account</div>
          <div className="self-stretch text-center text-white/70 text-base font-normal font-['Inter']">WeWrite</div>
        </div>
        <div className="self-stretch h-[263px] flex-col justify-start items-start gap-4 flex">
          <div className="self-stretch h-[77px] flex-col justify-start items-start gap-1.5 flex">
            <div className="self-stretch px-4 justify-center items-center gap-1 inline-flex">
              <div data-svg-wrapper className="relative">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.99844 7.20039C9.32392 7.20039 10.3984 6.12587 10.3984 4.80039C10.3984 3.47491 9.32392 2.40039 7.99844 2.40039C6.67295 2.40039 5.59844 3.47491 5.59844 4.80039C5.59844 6.12587 6.67295 7.20039 7.99844 7.20039Z" fill="white" fill-opacity="0.72"/>
              <path d="M2.39844 14.4004C2.39844 11.3076 4.90564 8.80039 7.99844 8.80039C11.0912 8.80039 13.5984 11.3076 13.5984 14.4004H2.39844Z" fill="white" fill-opacity="0.72"/>
              </svg>
              </div>
              <div className="grow shrink basis-0 text-white/70 text-base font-['SF Pro']">Username</div>
            </div>
            <input type="text" name="username" onChange={handleChange} value={user.username} className="self-stretch p-4 rounded-[17px] border justify-start items-center gap-2.5 inline-flex bg-white/10 focus:bg-[#1768ff]/30 focus:shadow-[0px_0px_54px_0px_rgba(0,131,253,0.40)] border-white/20 focus:border-[#1768ff]">
            </input>
          </div>
          <div className="self-stretch h-[77px] flex-col justify-start items-start gap-1.5 flex">
            <div className="self-stretch px-4 justify-center items-center gap-1 inline-flex">
              <div data-svg-wrapper className="relative">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.60423 4.70606L8.00152 7.90471L14.3989 4.70602C14.3506 3.86574 13.6539 3.19922 12.8016 3.19922H3.20156C2.34918 3.19922 1.65247 3.86576 1.60423 4.70606Z" fill="white" fill-opacity="0.72"/>
              <path d="M14.4016 6.49354L8.00152 9.69356L1.60156 6.49358V11.1992C1.60156 12.0829 2.31791 12.7992 3.20156 12.7992H12.8016C13.6852 12.7992 14.4016 12.0829 14.4016 11.1992V6.49354Z" fill="white" fill-opacity="0.72"/>
              </svg>
              </div>
              <div className="grow shrink basis-0 text-white/70 text-base font-['SF Pro']">Email</div>
            </div>
            <input type="email" name="email" onChange={handleChange} value={user.email} className="self-stretch p-4 rounded-[17px] border justify-start items-center gap-2.5 inline-flex bg-white/10 focus:bg-[#1768ff]/30 focus:shadow-[0px_0px_54px_0px_rgba(0,131,253,0.40)] border-white/20 focus:border-[#1768ff]">
            </input>
          </div>
          <div className="self-stretch h-[77px] flex-col justify-start items-start gap-1.5 flex">
            <div className="self-stretch px-4 justify-center items-center gap-1 inline-flex">
              <div data-svg-wrapper className="relative">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M3.99844 7.19961V5.59961C3.99844 3.39047 5.7893 1.59961 7.99844 1.59961C10.2076 1.59961 11.9984 3.39047 11.9984 5.59961V7.19961C12.8821 7.19961 13.5984 7.91595 13.5984 8.79961V12.7996C13.5984 13.6833 12.8821 14.3996 11.9984 14.3996H3.99844C3.11478 14.3996 2.39844 13.6833 2.39844 12.7996V8.79961C2.39844 7.91595 3.11478 7.19961 3.99844 7.19961ZM10.3984 5.59961V7.19961H5.59844V5.59961C5.59844 4.27413 6.67295 3.19961 7.99844 3.19961C9.32392 3.19961 10.3984 4.27413 10.3984 5.59961Z" fill="white"/>
              </svg>
              </div>
              <div className="grow shrink basis-0 text-white text-base font-['SF Pro']">Password</div>
            </div>
            <input type="password" name="password" onChange={handleChange} value={user.password} className="self-stretch p-4 bg-white/10 focus:bg-[#1768ff]/30 rounded-[17px] focus:shadow-[0px_0px_54px_0px_rgba(0,131,253,0.40)] border-2 border-white/20 focus:border-[#1768ff] justify-between items-center inline-flex">
            </input>
          </div>
        </div>
        <div className="self-stretch h-[75px] flex-col justify-start items-start gap-3 flex">
          <button type="submit" className="self-stretch px-4 py-2.5 rounded-2xl border border-white/20 justify-center items-center gap-1.5 inline-flex">
            <div className="text-white text-lg font-semibold font-['Inter Variable']">Create account</div>
          </button>
          <div className="self-stretch text-center text-white/70 text-[17px] font-normal font-['Inter']">Already have an account? <Link href="/auth/login">Sign in</Link></div>
        </div>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  );
};

export default RegisterForm;