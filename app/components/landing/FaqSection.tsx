"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import Link from "next/link";
import { Button } from "../ui/button";

export function FaqSection() {
  const faqs = [
    {
      question: "What is WeWrite?",
      answer: "WeWrite is a social notes app where every page is a fundraiser. It allows you to create, share, and monetize your content while connecting with other writers and readers."
    },
    {
      question: "How do I make money with WeWrite?",
      answer: "Readers can donate a small slice of their monthly budget to your pages, giving you a sustainable income. The more quality content you create and the more readers you attract, the more you can earn."
    },
    {
      question: "Is WeWrite free to use?",
      answer: "Yes, WeWrite is free to use for both writers and readers. Readers can choose to support writers by making donations, but there's no requirement to do so to access content."
    },
    {
      question: "Can I control who sees my content?",
      answer: "Yes, you have full control over the privacy of your pages. You can make them public for everyone to see, or keep them private for your eyes only."
    },
    {
      question: "How does the version history work?",
      answer: "Each page has a complete version history, allowing you and your readers to see how the content has evolved over time. This encourages ongoing improvement and provides transparency about changes."
    }
  ];

  return (
    <section className="w-full py-12 md:py-24 bg-black/50">
      <div className="container px-4 md:px-6">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">FAQs</h2>
          <p className="max-w-[85%] leading-normal text-gray-300 sm:text-lg sm:leading-7">
            Here are some frequently asked questions:
          </p>
        </div>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-white/10">
                <AccordionTrigger className="text-left text-base font-medium text-white hover:text-white/80">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-300">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/auth/register">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
