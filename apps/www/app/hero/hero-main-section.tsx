import Link from "next/link";

import { PrimaryButton, SecondaryButton } from "@/components/button";
import { BookOpen, ChevronRight, LogIn } from "lucide-react";

export function HeroMainSection() {
  return (
    <div className="relative flex flex-col items-center text-center ">
      <h1 className="bg-gradient-to-br text-pretty text-transparent bg-gradient-stop bg-clip-text from-white via-white via-30% to-white/30  font-medium text-[32px] leading-none sm:text-[64px] xl:text-[82px] tracking-tighter">
        Modern APIs <br /> Effortless Development.
      </h1>

      <p className="mt-6 sm:mt-8 bg-gradient-to-br text-transparent text-balance bg-gradient-stop bg-clip-text max-w-sm sm:max-w-lg xl:max-w-4xl from-white/70 via-white/70 via-40% to-white/30 text-sm sm:text-[20px]">
        Easily integrate comprehensive API features like API keys, rate limiting, and usage
        analytics, ensuring your API is ready to scale.
      </p>

      <div className="flex items-center gap-6 mt-16">
        <Link href="https://app.unkey.com" className="group">
          <PrimaryButton shiny IconLeft={LogIn} label="Get started" className="h-10" />
        </Link>

        <Link href="/docs" className="hidden sm:flex">
          <SecondaryButton IconLeft={BookOpen} label="Documentation" IconRight={ChevronRight} />
        </Link>
      </div>
    </div>
  );
}
