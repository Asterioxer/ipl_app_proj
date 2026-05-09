import "./globals.css";

export const metadata = {
  title: "IPL Player AI Akinator",
  description: "Guess the IPL player using AI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
