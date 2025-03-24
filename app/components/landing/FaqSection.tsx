"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";

export const FaqSection = () => {
  const faqs = [
    {
      question: "What is WeWrite?",
      answer: "WeWrite is a collaborative writing platform that allows teams and individuals to create, edit, and share documents with real-time collaboration features, multiple view modes, and smart paragraph styling."
    },
    {
      question: "Is WeWrite free to use?",
      answer: "WeWrite offers both free and premium plans. The free plan includes basic features like document creation and editing, while premium plans offer advanced collaboration tools, unlimited storage, and priority support."
    },
    {
      question: "Can I use WeWrite on mobile devices?",
      answer: "Yes! WeWrite is fully responsive and works on all modern devices including smartphones, tablets, laptops, and desktop computers."
    },
    {
      question: "How does the collaboration feature work?",
      answer: "Multiple users can edit the same document simultaneously. Changes appear in real-time, and our activity tracking feature shows who made which changes and when they were made."
    },
    {
      question: "What are the different paragraph modes?",
      answer: "WeWrite offers Normal mode with traditional paragraph indentation, Dense mode for continuous reading (similar to Bible verses), and various spacing options including Wrapped, Default, and Spaced views to customize your reading experience."
    },
    {
      question: "How secure is my data on WeWrite?",
      answer: "We take security seriously. All data is encrypted both in transit and at rest. We use Firebase for authentication and storage, which provides enterprise-grade security protections."
    }
  ];

  return (
    <section className="py-20 bg-background/50">
      <div className="container mx-auto px-6">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Everything you need to know about WeWrite
          </p>
        </motion.div>

        <motion.div 
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-lg font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};