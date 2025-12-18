"use client";
import { useState } from "react";

const ThreeTier: React.FC = () => {
  const [image, setImage] = useState(
    "https://plus.unsplash.com/premium_photo-1675018587751-76c5626f5b33?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
  );
  return (
    <section className="py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col">
          <p className="text-gray-500">Features</p>
          <h2 className="text-5xl font-regular mb-8 max-w-2xl mt-16">
            Transform your industry with affordable, cutting-edge innovation.
          </h2>
        </div>
        <div className="flex flex-col px-20">
          <div className="flex flex-row mt-10">
            <img
              src={image}
              alt="Electric Car"
              className="w-1/3 mb-8 object-cover object-center rounded-xl"
              style={{
                height: "300px"
              }}
            />
            <div className="flex flex-col w-2/3 pl-8">
              <h2 className="text-4xl font-regular mb-8 w-1/2">
                792 Cities and over 1 million marchers
              </h2>
              <p className="text-gray-500 pr-16">
                Our comprehensive IoT design and manufacturing process ensures
                that your ideas transform into fully realized, compliant
                products. We utilize the latest technologies and industry
                standards to deliver high-quality, innovative solutions that
                meet all regulatory requirements, streamlining your path from
                concept to market.
              </p>
            </div>
          </div>
          <div className="flex flex-row mt-10">
            <img
              src={image}
              alt="Electric Car"
              className="w-1/3 mb-8 object-cover object-center rounded-xl"
              style={{
                height: "300px"
              }}
            />
            <div className="flex flex-col w-2/3 pl-8">
              <h2 className="text-4xl font-regular mb-8 w-1/2">
                The platform for influencers by influencers
              </h2>
              <p className="text-gray-500 pr-16">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>
          </div>
          <div className="flex flex-row mt-10">
            <img
              src={image}
              alt="Electric Car"
              className="w-1/3 mb-8 object-cover object-center rounded-xl"
              style={{
                height: "300px"
              }}
            />
            <div className="flex flex-col w-2/3 pl-8">
              <h2 className="text-4xl font-regular mb-8 w-1/2">
                150 years sailing around the world
              </h2>
              <p className="text-gray-500 pr-16">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ThreeTier;
