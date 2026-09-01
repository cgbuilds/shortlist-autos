import type { Metadata } from "next";
import { OpenShare } from "@/components/OpenShare";

export const metadata: Metadata = {
  title: "Shared shortlist · Shortlist Autos",
  description: "Open a scored car shortlist someone sent you.",
};

export default function SharePage() {
  return <OpenShare />;
}
