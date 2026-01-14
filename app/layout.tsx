import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./globals.css";

import { headers } from 'next/headers'
import ContextProvider from './context/index'

export const metadata: Metadata = {
  title: "Fun Predict Market",
  description: "A simple place to explore crypto prediction markets. Share your insights, forecast digital assets and earn rewards.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>){

  const headersObj = await headers();
  const cookies = headersObj.get('cookie')

  return (
    <html lang="en">
      <body className="antialiased">
        <ContextProvider cookies={cookies}>
          {children}

        </ContextProvider>
      </body>
    </html>
  );
}