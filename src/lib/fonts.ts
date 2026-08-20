import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

export const matterDisplay = Newsreader({
  subsets: ["latin"],
  variable: "--mf-font-display",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export const matterBody = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--mf-font-body",
  weight: ["400", "500", "600"],
});

export const matterMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--mf-font-mono",
  weight: ["400", "500"],
});

export const matterFontVariables = `${matterDisplay.variable} ${matterBody.variable} ${matterMono.variable}`;
