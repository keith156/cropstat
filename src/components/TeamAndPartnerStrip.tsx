import React from 'react';

const TEAM_MEMBERS = [
  'Kato Peter',
  'Akampa Keith',
  'Naleera Albright',
  'Bakhita',
  'Ssewanyana Cyrus',
];

function MarqueeSequence({ variant }: { variant: 'solid' | 'outline' }) {
  return (
    <div className="flex items-center shrink-0">
      {TEAM_MEMBERS.map((name) => (
        <React.Fragment key={name}>
          <span
            className={
              variant === 'solid'
                ? 'px-4 sm:px-6 text-2xl sm:text-4xl font-bold tracking-tight whitespace-nowrap bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(16,185,129,0.28)] transition-transform duration-200 hover:scale-105'
                : 'px-4 sm:px-6 text-2xl sm:text-4xl font-bold tracking-tight whitespace-nowrap marquee-outline-text'
            }
          >
            {name}
          </span>
          <span
            aria-hidden="true"
            className="text-emerald-400/70 text-lg sm:text-2xl select-none drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]"
          >
            ✦
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export const TeamAndPartnerStrip: React.FC = () => {
  return (
    <section
      aria-label="Partners and The Team behind CropSat"
      className="border-t border-[#16221e] bg-gradient-to-b from-[#080c0b] via-[#0a120f] to-[#0a100e] mt-12 py-10 overflow-hidden"
    >
      <div className="max-w-[1440px] mx-auto px-5 sm:px-6">
        {/* Side-by-side square rounded image boxes */}
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
          <div className="w-28 h-28 sm:w-36 sm:h-36 aspect-square rounded-2xl bg-white p-3 flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.45)] border border-emerald-400/25 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5">
            <img
              src="/assets/aistudio/images__6__86f54115.png"
              alt="NASA Logo"
              className="w-full h-full object-contain select-none"
              loading="lazy"
            />
          </div>
          <div className="w-28 h-28 sm:w-36 sm:h-36 aspect-square rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.45)] border border-emerald-400/25 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-0.5">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-17_at_10.26.38_885515a3.jpeg"
              alt="NASA Space Apps Kampala Logo"
              className="w-full h-full object-contain rounded-xl select-none"
              loading="lazy"
            />
          </div>
        </div>

        {/* Title directly below the image boxes */}
        <div className="mt-7 text-center">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            The Team behind CropSat
          </h2>
          <div className="mt-2 mx-auto h-0.5 w-20 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </div>
      </div>

      {/* Dual-direction 2-line marquee */}
      <div className="mt-6 space-y-3 marquee-group marquee-mask select-none">
        {/* Line 1: Moving Left */}
        <div className="flex w-max animate-marquee-left" aria-label="Team members scrolling left">
          <MarqueeSequence variant="solid" />
          <MarqueeSequence variant="solid" />
        </div>

        {/* Line 2: Moving Right */}
        <div className="flex w-max animate-marquee-right" aria-label="Team members scrolling right">
          <MarqueeSequence variant="outline" />
          <MarqueeSequence variant="outline" />
        </div>
      </div>
    </section>
  );
};
