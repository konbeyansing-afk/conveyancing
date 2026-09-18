import { Newsreader } from "next/font/google";

export const matterDisplay = Newsreader({
  subsets: ["latin"],
  variable: "--mf-font-display",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});
